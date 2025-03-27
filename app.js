class ShellyManager {
    constructor() {
        this.mqttBroker = "wss://47567f9a74b445e6bef394abec5c83a1.s1.eu.hivemq.cloud:8884/mqtt";
        this.mqttOptions = {
            clientId: "web_client_" + Math.random().toString(16).substr(2, 8),
            username: "ShellyPlusPlugS",
            password: "Ciel92110",
            protocol: "wss"
        };
        this.client = null;
        this.prises = {}; // Stocke les prises dynamiquement

        this.initMQTT(); // Initialise la connexion MQTT
        this.initEventListeners(); // Active les événements
    }

    /** Initialisation MQTT */
    initMQTT() {
        this.client = mqtt.connect(this.mqttBroker, this.mqttOptions);
        
        // Quand la connexion est établie avec le broker MQTT
        this.client.on("connect", () => {
            console.log("Connecté au broker MQTT !");
            document.getElementById("status").textContent = "Connecté";
        });
        
        // Quand un message est reçu sur un topic MQTT
        this.client.on("message", (topic, message) => {
            console.log(`Message reçu de ${topic}:`, message.toString());
            this.updatePriseData(topic, message.toString());
        });
        
        // Gestion des erreurs de connexion MQTT
        this.client.on("error", (err) => {
            console.error("Erreur MQTT :", err);
            document.getElementById("status").textContent = "Erreur de connexion MQTT";
        });
    }


    /** Ajoute un événement sur le bouton "Ajouter une prise" */
    initEventListeners() {
        const addButton = document.getElementById("add-prise-btn");

        if (addButton) {
            addButton.addEventListener("click", () => {
                const name = document.getElementById("prise-name").value.trim();
                const topic = document.getElementById("prise-topic").value.trim();
                const ip = document.getElementById("prise-ip").value.trim();

                if (!name || !topic || !ip) {
                    alert("Veuillez remplir tous les champs !");
                    return;
                }

                this.addPrise(name, topic, ip);
            });
        } else {
            console.error("Bouton 'Ajouter une prise' non trouvé !");
        }
    }

    /** Ajoute une prise dynamiquement */
    addPrise(name, topic, ip) {
        if (this.prises[name]) {
            alert("Cette prise existe déjà !");
            return;
        }

        this.prises[name] = { topic, ip };

        const container = document.getElementById("prises-container");
        const priseDiv = document.createElement("div");
        priseDiv.classList.add("prise");
        priseDiv.id = name;
        priseDiv.innerHTML = `
            <h2>${name}</h2>
            <p><strong>Puissance :</strong> <span class="data power">-</span> W</p>
            <p><strong>Tension :</strong> <span class="data current">-</span> V</p>
            <p><strong>Consommation :</strong> <span class="data energy">0.000</span> kWh</p>
            <p><strong>Date :</strong> <span class="data date">-</span></p>
            <button class="turnOn">Allumer</button>
            <button class="turnOff">Éteindre</button>
            <button class="remove-prise">Supprimer</button>
        `;
        container.appendChild(priseDiv);

        this.client.subscribe(topic);

        priseDiv.querySelector(".turnOn").addEventListener("click", () => this.sendRequest(ip, true));
        priseDiv.querySelector(".turnOff").addEventListener("click", () => this.sendRequest(ip, false));
        priseDiv.querySelector(".remove-prise").addEventListener("click", () => this.removePrise(name));
    }

    /** Supprime une prise immédiatement et envoie la requête pour l'éteindre */
    removePrise(name) {
        if (!this.prises[name]) {
            console.warn(`Prise ${name} introuvable.`);
            return;
        }

        const ip = this.prises[name].ip;
        const url = `http://${ip}/relay/0?turn=off`;

        console.log(`Extinction de la prise ${name} en arrière-plan...`);

        fetch(url, { method: "GET" })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                return response.text();
            })
            .then(() => {
                console.log(`Prise ${name} éteinte avec succès.`);
            })
            .catch(error => {
                console.error(`Erreur lors de l'extinction de ${name}:`, error);
            });

        const topic = this.prises[name].topic;
        this.client.unsubscribe(topic);
        delete this.prises[name];

        const priseElement = document.getElementById(name);
        if (priseElement) {
            priseElement.remove();
            console.log(`Prise ${name} supprimée immédiatement.`);
        } else {
            console.warn(`Élément DOM introuvable pour ${name}`);
        }
    }

    /** Envoie une requête HTTP pour allumer/éteindre */
    sendRequest(ip, turnOn) {
        const action = turnOn ? "on" : "off";
        const url = `http://${ip}/relay/0?turn=${action}`;

        console.log(`Envoi requête à: ${url}`);

        fetch(url, { method: "GET" })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                console.log(`Réponse reçue: ${data}`);
            })
            .catch(error => {
                console.error("Erreur lors de la requête:", error);
            });
    }

    /** Met à jour les données reçues de MQTT */
    updatePriseData(topic, message) {
        const priseKey = Object.keys(this.prises).find(key => this.prises[key].topic === topic);
        if (!priseKey) return;

        try {
            const data = JSON.parse(message);
            const priseDiv = document.getElementById(priseKey);
            priseDiv.querySelector(".power").textContent = data.apower || "-";
            priseDiv.querySelector(".current").textContent = data.current || "-";
            priseDiv.querySelector(".energy").textContent = (data.total / 1000).toFixed(3) || "0.000";
            priseDiv.querySelector(".date").textContent = new Date(data.minute_ts * 1000).toLocaleString("fr-FR");
        } catch (err) {
            console.error("Erreur JSON:", err);
        }
    }
}

/** Instanciation de la classe pour démarrer l'application */
document.addEventListener("DOMContentLoaded", () => {
    new ShellyManager();
});
