require('dotenv').config();
const express = require('express');
const fs = require("fs");
const Cors = require("cors");
const path = require('path');
const twilio = require('twilio');
// const response = new twilio.Response();
// response.appendHeader('Access-Control-Allow-Origin', '*');
// response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
// response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
const BodyParser = require('body-parser');
const AccessToken = twilio.jwt.AccessToken;
const VoiceResponse = twilio.twiml.VoiceResponse;
const taskrouter = twilio.jwt.taskrouter;
const util = taskrouter.util;
const TaskRouterCapability = taskrouter.TaskRouterCapability;
const Policy = TaskRouterCapability.Policy;

const VoiceGrant = AccessToken.VoiceGrant;
const TASKROUTER_BASE_URL = 'https://taskrouter.twilio.com';
const version = 'v1';
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const app = express();
var router = express.Router();
app.use(Cors({
    origin: "*",
    allowedHeaders: ["Content-Type", "Authorization"]
}));
const activities = {
    "Offline": "WA520590de6681ddef0f370997a0562f9b",
    "Available": "WA1b2f786cf7dff20fea4e23af1e08b8df",
    "Unavailable": "WA681977fa391bd637a13d3ae805461d19",
    "OnCall": "WA3059b94e426e71b98f2b49e00c29ab6e"
};

app.use(BodyParser.json({
    extended: false
}));
app.use(BodyParser.urlencoded({
    extended: false
}));

app.use(router);
router.post('/incoming/', function (req, res) {
    // console.log(JSON.stringify(req.body));

    fs.appendFileSync('log.txt', `\n STARTING CALL LOG FOR ${req.body.CallSid} \n`);
    fs.appendFileSync('log.txt', JSON.stringify({ "callData": req.body }));
    fs.appendFileSync('log.txt', "\n");
    var twimlResponse = new VoiceResponse();
    var gather = twimlResponse.gather({
        numDigits: 1,
        action: '/enqueue/',
        method: 'POST'
    });
    gather.say('For Support, press one. For Payment, press any other key.');
    res.type('text/xml');
    // console.log(twimlResponse.toString());
    res.send(twimlResponse.toString());
});

// POST /call/enqueue
router.post('/enqueue/', function (req, res) {
    // console.log(JSON.stringify(req.body));
    fs.appendFileSync('log.txt', `Digit Pressed ${req.body.Digits}\n`);
    var pressedKey = req.body.Digits;
    var twimlResponse = new VoiceResponse();
    var selectedProduct = (pressedKey === '1') ? 'support' : 'payment';
    var enqueue = twimlResponse.enqueue(
        { workflowSid: (pressedKey === '1') ? process.env.WORK_FLOW_ID : process.env.WORK_FLOW_ID_2 }
    );
    fs.appendFileSync('log.txt', `Assiging to workFlowTask ${process.env.WORK_FLOW_ID}\n`);
    enqueue.task({
        priority: (pressedKey === '1') ? 5 : 1,
        timeout: 500
    }, JSON.stringify({ selected_product: selectedProduct }));

    res.setHeader('Content-Type', 'application/xml');
    res.write(enqueue.toString());
    res.end();
    // res.type('text/xml');
    // res.send(twimlResponse.toString());
});
router.post("/allCallBacks", function (req, res) {
    fs.appendFileSync('callback.txt', `Callback ${JSON.stringify(req.body)}\n`);

    // if (req.body.EventType === "task.created") {
    //     let taskAttributes = JSON.parse(req.body.TaskAttributes);
    //     taskAttributes.selectedWorker = ["WKc724d45be7f5d10242ac4d0bb923a0e3"];
    //     twilioClient.taskrouter.v1.workspaces(process.env.TWILIO_WORKSPACE_ID)
    //         .tasks(req.body.TaskSid)
    //         .update({
    //             attributes: JSON.stringify(taskAttributes)
    //         });
    // }
    res.status(200);
    // console.log((req.body));

});

app.get('/pending-tasks', (req, res) => {
    twilioClient.taskrouter.v1.workspaces(process.env.TWILIO_WORKSPACE_ID)
        .tasks
        .list({
            assignmentStatus: "pending",
            limit: 20
        })
        .then(tasks => res.status(200).json(tasks))
        .catch(ex => {
            console.log(ex);
            res.status(500);
        });
});

app.post("/pick-call", (req, res) => {
    if (req.body.taskId && req.body.workerId) {
        twilioClient.taskrouter.v1.workspaces(process.env.TWILIO_WORKSPACE_ID)
            .tasks(req.body.taskId)
            .fetch()
            .then(task => {
                let taskAttributes = JSON.parse(task.attributes);
                taskAttributes.selectedWorker = [];
                taskAttributes.selectedWorker.push(req.body.workerId);
                twilioClient.taskrouter.v1.workspaces(process.env.TWILIO_WORKSPACE_ID)
                    .tasks(req.body.taskId)
                    .update({
                        attributes: JSON.stringify(taskAttributes)
                    });
            })

    }
    res.status(200);
});

app.post('/voice', twilio.webhook({ validate: false }), function (req, res) {
    var phoneNumber = req.body.phoneNumber;
    var callerId = process.env.TWILIO_NUMBER;
    var twiml = new VoiceResponse();

    var dial = twiml.dial({ callerId: callerId });
    if (phoneNumber) {
        dial.number({}, phoneNumber);
    } else {
        dial.client({}, "support");
    }

    res.send(twiml.toString());
});

app.post('/token', (req, res) => {
    const clientName = req.body.clientName;

    const accessToken = new AccessToken(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET);
    accessToken.identity = clientName;

    const grant = new VoiceGrant({
        incomingAllow: true
    });

    accessToken.addGrant(grant);

    res.status(200).json({ token: accessToken.toJwt() });
});
router.post("/holdCall", function (req, res) {
    fs.appendFileSync('log.txt', `Holding Call with assigned worker ${JSON.stringify(req.body)}\n`);
    console.log((req.body));
    res.status(200);
});
app.get('/worker', (req, res) => {
    twilioClient.taskrouter.v1.workspaces(process.env.TWILIO_WORKSPACE_ID)
        .workers
        .list({
            targetWorkersExpression: `friendly_name IN ['${req.query.name}']`
        })
        .then(workers => {
            if (workers && workers[0]) {
                res.status(200).json({ workerId: workers[0].sid });
            }

            res.status(500).end();
        })
        .catch(ex => {
            res.status(500).end();
        })
});

app.post('/worker', (req, res) => {
    let attributes = {
        "contact_uri": `client:${req.body.workerName}`
    }

    twilioClient.taskrouter.v1.workspaces(process.env.TWILIO_WORKSPACE_ID)
        .workers
        .create({
            friendlyName: req.body.workerName,
            attributes: JSON.stringify(attributes)
        })
        .then((worker) => {
            res.status(201).json({
                workerId: worker.sid
            });
        })
        .catch((ex) => {
            res.status(500).json(ex);
        })
});

app.post("/worker-token", (req, res) => {
    const capability = new TaskRouterCapability({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        workspaceSid: process.env.TWILIO_WORKSPACE_ID,
        channelId: req.body.workerId
    });

    const eventBridgePolicies = util.defaultEventBridgePolicies(process.env.TWILIO_ACCOUNT_SID, req.body.workerId);

    // Worker Policies
    const workerPolicies = util.defaultWorkerPolicies(version, process.env.TWILIO_WORKSPACE_ID, req.body.workerId);

    const workspacePolicies = [
        // Workspace fetch Policy
        buildWorkspacePolicy(),
        // Workspace subresources fetch Policy
        buildWorkspacePolicy({ resources: ['**'] }),
        buildWorkspacePolicy({ resources: ['**'], method: 'POST' }),
        // Workspace Activities Update Policy
        buildWorkspacePolicy({ resources: ['Activities'], method: 'POST' }),
        // Workspace Activities Worker Reserations Policy
        buildWorkspacePolicy({ resources: ['Workers', req.body.workerId, 'Reservations', '**'], method: 'POST' }),
        buildWorkspacePolicy({ resources: ['Tasks', '**', 'Reservations', "**"], method: 'POST' })


    ];

    eventBridgePolicies.concat(workerPolicies).concat(workspacePolicies).forEach(function (policy) {
        capability.addPolicy(policy);
    });

    const token = capability.toJwt();

    res.status(201).json({ token });
});

app.post("/worker-status", (req, res) => {
    twilioClient.taskrouter.v1.workspaces(process.env.TWILIO_WORKSPACE_ID)
        .workers(req.body.workerId)
        .update({
            activitySid: activities[req.body.activityName]
        })
        .then(worker => res.status(200).end())
        .catch(ex => { console.log(ex); res.status(500).end(); });
});

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(__dirname, '/worker/worker.html'));
});

app.get('/js/:filename', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, `/js/${req.params.filename}`));
});

app.listen(3000, () => {
    console.log('Listening on 3000');
});

function buildWorkspacePolicy(options) {
    options = options || {};
    var resources = options.resources || [];
    var urlComponents = [TASKROUTER_BASE_URL, version, 'Workspaces', process.env.TWILIO_WORKSPACE_ID]

    return new Policy({
        url: urlComponents.concat(resources).join('/'),
        method: options.method || 'GET',
        allow: true
    });
};