document.addEventListener("DOMContentLoaded", () => {
    const createBtn = document.getElementById("create");
    const onlineBtn = document.getElementById("online");
    const offlineBtn = document.getElementById("offline");
    const workerTokenBtn = document.getElementById("worker-token");
    const getWorkerBtn = document.getElementById("get-worker");
    const statusHeader = document.getElementById("status");
    const currentWorker = document.getElementById("current");
    const getTasksBtn = document.getElementById("pending");
    const taskList = document.getElementById("tasks");
    const getRealTimeStatistics = document.getElementById("get-real-time-statistics");
    const number = document.getElementById("number");
    const outgoingBtn = document.getElementById("outgoing-call");

    const twilioResourceDetails = {
        device: undefined,
        worker: undefined,
        workerId: undefined,
        clientName: undefined
    };

    function transferCall(taskId) {
        fetch('/transfer-call', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ taskId })
        });
    }

    function updateHoldStatus(conferenceId, callerId, hold) {
        fetch('/hold-status', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ conferenceId, callerId, hold })
        });
    }

    function pullCall(event) {
        fetch('/pick-call', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                taskId: event.srcElement.previousSibling.textContent,
                workerId: twilioResourceDetails.workerId
            })
        });
    }

    function hangCall(conferenceId, callerId, taskId) {
        fetch('/hang-call', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ conferenceId, callerId, taskId })
        });
    }

    getRealTimeStatistics.addEventListener("click", async () => {
        let components = ["WORKSPACE", "WORKFLOWS", "TASKQUEUES", "WORKERS", "TASKS"];
        let data = {};
        fetch(`/statistics/real-time?component=${components[0]}`)
            .then(async res => {
                data = await res.json();
                __console(data);
                return fetch(`/statistics/real-time?component=${components[1]}`);
            })
            .then(async res => {
                data = await res.json();
                __console(data);
                return fetch(`/statistics/real-time?component=${components[2]}`);
            })
            .then(async res => {
                data = await res.json();
                __console(data);
                return fetch(`/statistics/real-time?component=${components[3]}`);
            })
            .then(async res => {
                data = await res.json();
                __console(data);
                return fetch(`/statistics/real-time?component=${components[4]}`);
            })
            .then(async res => {
                data = await res.json();
                __console(data);
                return;
            })
            .catch(ex => {
                __console(ex);
            })
    });

    function __console(content) {
        console.log(content);
        return;
    }

    getTasksBtn.addEventListener("click", () => {
        fetch('/pending-tasks')
            .then(res => res.json())
            .then(data => {
                taskList.innerHTML = "";
                data.forEach(task => {
                    let li = document.createElement('li');
                    li.classList.add("list-group-item");
                    let btn = document.createElement('button');
                    btn.classList.add("btn", "btn-sm", "btn-success", "ms-3");
                    btn.innerText = 'Reserve this call';
                    btn.addEventListener("click", pullCall);
                    let textNode = document.createTextNode(task.sid);
                    li.append(textNode);
                    li.appendChild(btn);
                    taskList.appendChild(li);
                });
            })
            .catch(ex => console.log(ex));
    });

    getWorkerBtn.addEventListener("click", () => {
        let workerName = document.getElementById("worker-name");

        if (workerName && workerName.value) {
            fetch(`/worker?name=${workerName.value}`)
                .then(res => res.json())
                .then(data => {
                    twilioResourceDetails.workerId = data.workerId;
                    twilioResourceDetails.clientName = workerName.value;

                    currentWorker.innerText = `Current Worker: ${twilioResourceDetails.clientName}`;
                    workerName.value = "";
                })
                .catch(ex => console.log(ex));
        }
    });

    createBtn.addEventListener("click", () => {
        let workerName = document.getElementById("worker-name");

        if (workerName && workerName.value) {
            fetch("/worker", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workerName: workerName.value })
            })
                .then((res) => res.json())
                .then((data) => {
                    console.log(data);
                    twilioResourceDetails.workerId = data.workerId;
                    twilioResourceDetails.clientName = workerName.value;

                    currentWorker.innerText = `Current Worker: ${twilioResourceDetails.clientName}`;
                })
                .catch((ex) => console.log(ex));
        }
    });

    workerTokenBtn.addEventListener("click", () => {
        if (twilioResourceDetails && twilioResourceDetails.workerId && twilioResourceDetails.clientName) {
            fetch("/worker-token", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workerId: twilioResourceDetails.workerId })
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data && data.token) {
                        const worker = new Twilio.TaskRouter.Worker(data.token);
                        twilioResourceDetails.worker = worker;
                        registerWorkerCallbacks(worker);
                    }
                })
                .catch((ex) => console.log(ex));

            fetch("/token", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ clientName: twilioResourceDetails.clientName })
            })
                .then(res => res.json())
                .then(data => {
                    if (data && data.token) {
                        const device = new Twilio.Device(data.token, {
                            // Set Opus as our preferred codec. Opus generally performs better, requiring less bandwidth and
                            // providing better audio quality in restrained network conditions. Opus will be default in 2.0.
                            codecPreferences: ["opus", "pcmu"],
                            // Use fake DTMF tones client-side. Real tones are still sent to the other end of the call,
                            // but the client-side DTMF tones are fake. This prevents the local mic capturing the DTMF tone
                            // a second time and sending the tone twice. This will be default in 2.0.
                            fakeLocalDTMF: true,
                            // Use `enableRingingState` to enable the device to emit the `ringing`
                            // state. The TwiML backend also needs to have the attribute
                            // `answerOnBridge` also set to true in the `Dial` verb. This option
                            // changes the behavior of the SDK to consider a call `ringing` starting
                            // from the connection to the TwiML backend to when the recipient of
                            // the `Dial` verb answers.
                            enableRingingState: true
                        });
                        twilioResourceDetails.device = device;
                        device.register();
                        registerDeviceCallbacks(device);
                    }
                })
        }
    });

    outgoingBtn.addEventListener("click", async () => {
        if (number && number.value && twilioResourceDetails.device) {
            const params = {
                phoneNumber: number.value,
                outgoing: true
            };

            const call = await twilioResourceDetails.device.connect({
                params: params
            });

            let currentCall = document.getElementById("in-call");
            currentCall.innerHTML = "";

            let hangCallBtn = document.createElement("button");
            hangCallBtn.classList.add("btn", "btn-sm", "ms-3", "btn-danger");
            hangCallBtn.innerText = "Hang Up Call";
            hangCallBtn.addEventListener("click", function () {
                twilioResourceDetails.device.disconnectAll();
            });



            let textNode = document.createTextNode(`In call with ${number.value}`);

            currentCall.appendChild(textNode);
            currentCall.appendChild(hangCallBtn);

            call.on("disconnect", (data) => {
                currentCall.innerHTML = "";
                console.log('Disconnected');
                // console.log(data);
            });


            console.log(call);
        }
    });

    onlineBtn.addEventListener("click", () => {
        if (twilioResourceDetails.worker && twilioResourceDetails.workerId) {
            fetch("/worker-status", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workerId: twilioResourceDetails.workerId, activityName: "Available" })
            })
                .catch((ex) => console.log(ex));
        }
    });

    offlineBtn.addEventListener("click", () => {
        if (twilioResourceDetails.worker && twilioResourceDetails.workerId) {
            fetch("/worker-status", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ workerId: twilioResourceDetails.workerId, activityName: "Offline" })
            })
                .catch((ex) => console.log(ex));
        }
    });

    function registerDeviceCallbacks(device) {
        device.on('registered', device => {
            console.log("Device ready to receive calls");
        });

        device.on("incoming", function (conn) {
            console.log("Incoming call from ", conn);
            // // Set a callback to be executed when the connection is accepted
            conn.accept(function () {
                console.log('Call connected');
            });
        });
    };

    function registerWorkerCallbacks(worker) {
        worker.on("ready", (worker) => {
            console.log(worker);
        });

        worker.on("activity.update", (worker) => {
            console.log(worker.activityName)
            statusHeader.innerText = `Current Status: ${worker.activityName}`;
        });

        worker.on("reservation.accepted", (reservation) => {
            console.log(reservation);
            let currentCall = document.getElementById("in-call");
            currentCall.innerHTML = "";

            let holdCallBtn = document.createElement("button");
            holdCallBtn.classList.add("btn", "btn-sm", "ms-3", "btn-info");
            holdCallBtn.innerText = "Hold Call";
            holdCallBtn.addEventListener("click", function () {
                updateHoldStatus(reservation.task.attributes.conference.sid,
                    reservation.task.attributes.conference.participants.customer, true);
            });

            let unholdCallBtn = document.createElement("button");
            unholdCallBtn.classList.add("btn", "btn-sm", "ms-3", "btn-info");
            unholdCallBtn.innerText = "Unhold Call";
            unholdCallBtn.addEventListener("click", function () {
                updateHoldStatus(reservation.task.attributes.conference.sid,
                    reservation.task.attributes.conference.participants.customer, false);
            });

            let transferCallBtn = document.createElement("button");
            transferCallBtn.classList.add("btn", "btn-sm", "ms-3", "btn-warning");
            transferCallBtn.innerText = "Transfer Call";
            transferCallBtn.addEventListener("click", function () {
                transferCall(reservation.task.sid);
            });

            let hangCallBtn = document.createElement("button");
            hangCallBtn.classList.add("btn", "btn-sm", "ms-3", "btn-danger");
            hangCallBtn.innerText = "Hang Up Call";
            hangCallBtn.addEventListener("click", function () {
                hangCall(reservation.task.attributes.conference.sid,
                    reservation.task.attributes.conference.participants.customer,
                    reservation.task.sid);
            });



            let textNode = document.createTextNode(`In call with ${reservation.task.attributes.caller}`);

            currentCall.appendChild(textNode);
            currentCall.appendChild(holdCallBtn);
            currentCall.appendChild(unholdCallBtn);
            currentCall.appendChild(transferCallBtn);
            currentCall.appendChild(hangCallBtn);
        });

        worker.on("reservation.created", (reservation) => {
            if (!reservation.task.attributes.conference) {
                setTimeout(() => {
                    const options = {
                        "ConferenceStatusCallback": "https://ba6c-49-249-16-218.in.ngrok.io/allCallBacks",
                        "ConferenceStatusCallbackEvent": "start,end,join,leave",
                        "EndConferenceOnExit": "false",
                        "EndConferenceOnCustomerExit": "true"
                    };

                    reservation.conference(null, null, null, null, function (error, reservation) {
                        console.log(error);
                    }, options);
                }, 2000);
            } else {
                reservation.call(
                    null,
                    `https://ba6c-49-249-16-218.in.ngrok.io/call-answer/${reservation.task.attributes.conference.room_name}`,
                    null,
                    "true",
                    null
                );
            }
        });

        worker.on("reservation.wrapup", function (reservation) {
            let currentCall = document.getElementById("in-call");
            currentCall.innerHTML = "";
            worker.completeTask(reservation.task.sid);
        });
    };
});