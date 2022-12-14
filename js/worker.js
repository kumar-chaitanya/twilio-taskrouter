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

    const twilioResourceDetails = {
        device: undefined,
        worker: undefined,
        workerId: undefined,
        clientName: undefined
    };

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

    getTasksBtn.addEventListener("click", () => {
        fetch('/pending-tasks')
            .then(res => res.json())
            .then(data => {
                taskList.innerHTML = "";
                data.forEach(task => {
                    let li = document.createElement('li');
                    let btn = document.createElement('button');
                    btn.innerText = 'Pick this call';
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

            // // Set a callback on the answer button and enable it
            // answerButton.click(function () {
            //     conn.accept();
            // });
            // answerButton.prop("disabled", false);
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

        worker.on("reservation.created", (reservation) => {
            reservation.dequeue();
        })
    };
});