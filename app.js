const express = require('express');
const fs = require('fs');
const app = express();
const BodyParser = require("body-parser");
const port = 3000;
var router = express.Router(),
    VoiceResponse = require('twilio/lib/twiml/VoiceResponse');
require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
app.use(BodyParser.json({
    extended: false
}));
app.use(BodyParser.urlencoded({
    extended: false
}));

// POST /call/incoming
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
    gather.say('For Normal Support, press one. For Payment Support, press any other key.');
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
        { workflowSid: (pressedKey === '1') ? process.env.WORK_FLOW_ID : "WW1105a486b5cf6d2fc86f79430ce3f348" }
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

router.post("/holdCall", function (req, res) {
    fs.appendFileSync('log.txt', `Holding Call with assigned worker ${JSON.stringify(req.body)}\n`);
    console.log((req.body));
    res.status(200);
});

router.get("/taskQueues", function (req, res) {

    client.taskrouter.v1.workspaces('WSc3a0654d628b9b36b6effff13486b330')
        .taskQueues
        .list({ limit: 20 })
        .then(taskQueues => res.status(200).json({ taskQueues: taskQueues }));


});

router.get('/incoming/:status', function (req, res) {
    var targetActivity = (req.params.status.toLowerCase() === "on") ? "idle" : "offline";
    var activitySid = app.get('workspaceInfo').activities[targetActivity];
    changeWorkerActivitySid(req.body.From, activitySid);
    res.type('text/xml');
    res.send(twimlGenerator.generateConfirmMessage(targetActivity));
});


function changeWorkerActivitySid(workerNumber, activitySid) {
    var accountSid = process.env.TWILIO_ACCOUNT_SID,
        authToken = process.env.TWILIO_AUTH_TOKEN,
        workspaceSid = app.get('workspaceInfo').workspaceSid,
        workerSid = app.get('workerInfo')[workerNumber],
        twilio = require('twilio'),
        client = new twilio.TaskRouterClient(accountSid, authToken, workspaceSid);
    client.workspace.workers(workerSid).update({ activitySid: activitySid });
}
router.get("/workers", function (req, res) {
    client.taskrouter.v1.workspaces('WSc3a0654d628b9b36b6effff13486b330')
        .workers
        .list({
            limit: 20
        })
        .then(workers => res.status(200).json({ taskQueues: workers }));
});


router.get("/tasks", function (req, res) {
    client.taskrouter.v1.workspaces('WSc3a0654d628b9b36b6effff13486b330')
        .tasks
        .list({
            limit: 20,
            // assignment_status: ["canceled"]
        })
        .then(tasks => res.status(200).json({ tasks: tasks }));
});

router.get("/getFlow/:flowId", function (req, res) {

    client.studio.v2
        .flows(req.params.flowId)
        .fetch()
        .then(flows => res.status(200).json({ flows: flows }));
});
router.get("/getFlows", function (req, res) {

    client.studio.v2
        .flows
        .list({
            limit: 20,
            // assignment_status: ["canceled"]
        })
        .then(flows => res.status(200).json({ flows: flows }));
    // https://studio.twilio.com/v2/Flows
});




// POST /call/assignment
router.post('/assignment/', function (req, res) {
    res.type('application/json');
    res.send({
        instruction: "dequeue",
        post_work_activity_sid: app.get('workspaceInfo').activities.idle
    });
});

router.post("/callReceived", function (req, res) {

    console.log(JSON.stringify(req.body));
    res.sendStatus(200);
});

app.use(router);




app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});