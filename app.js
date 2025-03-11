document.addEventListener("DOMContentLoaded", () => {
    const prisesContainer = document.getElementById("prisesContainer");
    const addPriseBtn = document.getElementById("addPriseBtn");
    const priseFormContainer = document.getElementById("priseFormContainer");
    const priseForm = document.getElementById("priseForm");

    let prises = [];
    const mqttClient = mqtt.connect("wss://47567f9a74b445e6bef394abec5c83a1.s1.eu.hivemq.cloud:8884/mqtt", {
        clientId: "web_client_" + Math.random().toString(16).substr(2, 8),
        username: "ShellyPlusPlugS",
        password: "Ciel92110",
        protocol: "wss"
    });

    mqttClient.on("connect", () => {
        document.getElementById("status").textContent = "✅ Connecté";
        console.log("✅ Connecté au broker MQTT");
    });

    mqttClient.on("message", (topic, message) => {
        const data = JSON.parse(message.toString());
        const prise = prises.find(p => p.topic === topic);
        if (prise) {
            document.getElementById(`power-${prise.id}`).textContent = `${data.apower} W`;
            document.getElementById(`energy-${prise.id}`).textContent = `${(data.total / 1000).toFixed(3)} kWh`;
            document.getElementById(`state-${prise.id}`).textContent = data.relay === "on" ? "Occupée" : "Libre";
        }
    });

    addPriseBtn.addEventListener("click", () => {
        priseFormContainer.classList.toggle("d-none");
    });

    priseForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const priseName = document.getElementById("priseName").value;
        const topic = document.getElementById("topic").value;
        const id = prises.length + 1;

        prises.push({ id, name: priseName, topic });
        mqttClient.subscribe(topic);

        prisesContainer.innerHTML += `
            <div class="col-md-4">
                <div class="prise-card" id="prise-${id}">
                    <h2>${priseName}</h2>
                    <p><strong>Puissance :</strong> <span id="power-${id}" class="data">- W</span></p>
                    <p><strong>Consommation :</strong> <span id="energy-${id}" class="data">0.000 kWh</span></p>
                    <p><strong>État :</strong> <span id="state-${id}" class="data">Libre</span></p>
                    <button class="btn btn-success" onclick="togglePrise(${id}, true)">Allumer</button>
                    <button class="btn btn-danger" onclick="togglePrise(${id}, false)">Éteindre</button>
                </div>
            </div>
        `;

        priseForm.reset();
        priseFormContainer.classList.add("d-none");
    });
});

function togglePrise(id, turnOn) {
    console.log(`Prise ${id} : ${turnOn ? "Allumée" : "Éteinte"}`);
}
