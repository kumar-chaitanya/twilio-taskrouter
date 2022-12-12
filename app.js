const express = require('express');
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
// const twilioCTI = require("./twilio-cti");
// var TWILIO_WORKSPACE_ID = process.env.TWILIO_WORKSPACE_ID;
// let __twilioCTI = new twilioCTI();
// // __twilioCTI.initClient();
// var WORKSPACE_NAME = 'TaskRouter Node Workspace';
// //__twilioCTI.createWorkspace();
// (async () => {
//     let isWorkSpacePresent = await __twilioCTI.initClient(TWILIO_WORKSPACE_ID);
//     if (!isWorkSpacePresent) {
//         __twilioCTI.createWorkspace(WORKSPACE_NAME);
//     } else {

//     }
// })();








// POST /call/incoming
router.post('/incoming/', function (req, res) {
    var twimlResponse = new VoiceResponse();
    var gather = twimlResponse.gather({
        numDigits: 1,
        action: '/enqueue/',
        method: 'POST'
    });
    gather.say('For Normal Support, press one. For Payment Support, press any other key.');
    res.type('text/xml');
    console.log(twimlResponse.toString());
    res.send(twimlResponse.toString());
});

// POST /call/enqueue
router.post('/enqueue/', function (req, res) {
    var pressedKey = req.body.Digits;
    var twimlResponse = new VoiceResponse();
    var selectedProduct = (pressedKey === '1') ? 'support' : 'payment';
    var enqueue = twimlResponse.enqueue(
        { workflowSid: (pressedKey === '1') ? "WW691193cb80241adce46cfac5463e05b0" : "WW1105a486b5cf6d2fc86f79430ce3f348" }
    );
    enqueue.task({
        priority: 5,
        timeout: 500
    }, JSON.stringify({ selected_product: selectedProduct }));
    res.setHeader('Content-Type', 'application/xml');
    res.write(enqueue.toString());
    res.end();
    // res.type('text/xml');
    // res.send(twimlResponse.toString());
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
            limit: 20
        })
        .then(tasks => res.status(200).json({ tasks: tasks }));
    // .then(workers => res.status(200).json({ taskQueues: workers }));
});

// router.get("/tasks", function (req, res) {
//     client.taskrouter.v1.workspaces('WSc3a0654d628b9b36b6effff13486b330')
//     .tasks()
//     .fetch()
//     .then(task => console.log(task.taskQueueFriendlyName))
//     .catch(ex => console.log(ex));
// });

// router.get("/taskChannels", function (req, res) {
//     client.taskrouter.v1.workspaces('WSc3a0654d628b9b36b6effff13486b330')
//     .taskChannels()
//     .fetch()
//     .then(task_channel => console.log(task_channel.friendlyName))
//     .catch(ex => console.log(ex));
// });


// POST /call/assignment
router.post('/assignment/', function (req, res) {
    res.type('application/json');
    res.send({
        instruction: "dequeue",
        post_work_activity_sid: app.get('workspaceInfo').activities.idle
    });
});

app.use(router);




app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});