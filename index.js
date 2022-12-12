const express = require('express');
const path = require('path');
const twilio = require('twilio');
const BodyParser = require('body-parser');
const AccessToken = require('twilio').jwt.AccessToken;
const VoiceResponse = twilio.twiml.VoiceResponse;

const VoiceGrant = AccessToken.VoiceGrant;
const app = express();

app.use(BodyParser.json({
    extended: false
}));
app.use(BodyParser.urlencoded({
    extended: false
}));

app.post('/voice', twilio.webhook({ validate: false }), function (req, res) {
    var phoneNumber = req.body.phoneNumber;
    var callerId = '+13867031616';
    var twiml = new VoiceResponse();

    var dial = twiml.dial({ callerId: callerId });
    if (phoneNumber) {
        dial.number({}, phoneNumber);
    } else {
        dial.client({}, "support");
    }

    res.send(twiml.toString());
});

app.get('/token', (req, res) => {
    const clientName = "support"

    const accessToken = new AccessToken('AC79d92e81368d553caea3d593e63d9c30', 'SK76976b19f563564fb28c5ca700c6e66f', 'IF2xL28X8bpfjX5BdESQPAPWNX3K40BT');
    accessToken.identity = clientName;

    const grant = new VoiceGrant({
        incomingAllow: true
    });

    accessToken.addGrant(grant);

    res.status(200).json({ token: accessToken.toJwt() });
});

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.get('/:filename', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, `/${req.params.filename}`));
});

app.listen(3000, () => {
    console.log('Listening on 3000');
});