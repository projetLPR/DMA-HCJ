// --- Classe ShellyManager ---
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
        this.apiUrl = 'http://localhost:3000';

        this.initMQTT(); // Connexion MQTT
        this.initEventListeners(); // Bouton "Ajouter"
        this.loadPrisesFromAPI(); // Charge à l'ouverture
    }

    initMQTT() {
        this.client = mqtt.connect(this.mqttBroker, this.mqttOptions);

        this.client.on("connect", () => {
            console.log("✅ Connecté au broker MQTT !");
            document.getElementById("status").textContent = "✅ Connecté";
        });

        this.client.on("message", (topic, message) => {
            console.log(`📩 Message reçu de ${topic}:`, message.toString());
            this.updatePriseData(topic, message.toString());
        });

        this.client.on("error", (err) => {
            console.error("❌ Erreur MQTT :", err);
            document.getElementById("status").textContent = "❌ Erreur de connexion MQTT";
            this.client.end();
        });

        this.client.on("offline", () => {
            document.getElementById("status").textContent = "❌ Hors ligne";
        });

        this.client.on("close", () => {
            document.getElementById("status").textContent = "❌ Connexion fermée";
        });
    }

    initEventListeners() {
        const addButton = document.getElementById("add-prise-btn");
        if (addButton) {
            addButton.addEventListener("click", () => {
                const name = document.getElementById("prise-name").value.trim();
                const locality = document.getElementById("prise-locality").value.trim();
                const id = document.getElementById("prise-id").value.trim();

                if (!name || !locality || !id) {
                    alert("⚠️ Veuillez remplir tous les champs !");
                    return;
                }

                this.addPrise(name, locality, id);
            });
        }
    }

    loadPrisesFromAPI() {
        fetch(`${this.apiUrl}/ids`)
            .then(res => res.json())
            .then(data => {
                data.forEach(prise => {
                    const id = prise.valeur_id;
                    const name = prise.nom_prise;
                    const locality = prise.localite;

                    if (!this.prises[id]) {
                        this.addPrise(name, locality, id);
                    }
                });
            })
            .catch(err => console.error("Erreur chargement API:", err));
    }

    refreshPrisesFromAPI() {
        // Supprimer toutes les prises affichées
        Object.keys(this.prises).forEach(id => this.removePrise(id));
        // Recharger depuis la BDD
        this.loadPrisesFromAPI();
    }

    addPrise(name, locality, id) {
        if (this.prises[id]) return;

        this.prises[id] = { name, locality, id };

        const container = document.getElementById("prises-container");
        const priseDiv = document.createElement("div");
        priseDiv.classList.add("prise");
        priseDiv.id = id;
        priseDiv.innerHTML = `
            <h2>${name} - <em>${locality}</em></h2>
            <p><strong>ID :</strong> ${id}</p>
            <p><strong>État :</strong> <span class="state">-</span></p>
            <p><strong>Puissance :</strong> <span class="power">-</span> W</p>
            <p><strong>Consommation :</strong> <span class="energy">0.000</span> kWh</p>
            <p><strong>Date :</strong> <span class="date">-</span></p>
            <button class="turnOn">Allumer</button>
            <button class="turnOff">Éteindre</button>
            <button class="remove-prise">Supprimer</button>
        `;
        container.appendChild(priseDiv);

        this.client.subscribe(`shellyplusplugs-${id}/test`);

        const requestPayload = {
            id: Date.now(),
            src: "web_client",
            method: "Switch.Get",
            params: { id: 0 }
        };
        this.client.publish(`shellyplusplugs-${id}/rpc`, JSON.stringify(requestPayload));

        priseDiv.querySelector(".turnOn").addEventListener("click", () => this.togglePrise(id, true));
        priseDiv.querySelector(".turnOff").addEventListener("click", () => this.togglePrise(id, false));
        priseDiv.querySelector(".remove-prise").addEventListener("click", () => this.removePrise(id));
    }

    togglePrise(id, turnOn) {
        const payload = {
            id: 1,
            src: "web_client",
            method: "Switch.Set",
            params: { id: 0, on: turnOn }
        };

        this.client.publish(`shellyplusplugs-${id}/rpc`, JSON.stringify(payload));
        const priseDiv = document.getElementById(id);
        if (priseDiv) {
            priseDiv.querySelector(".state").textContent = turnOn ? "Allumée" : "Éteinte";
            priseDiv.querySelector(".date").textContent = new Date().toLocaleString("fr-FR");
        }
    }

    removePrise(id) {
        if (!this.prises[id]) return;

        this.togglePrise(id, false);
        this.client.unsubscribe(`shellyplusplugs-${id}/test`);
        delete this.prises[id];

        const element = document.getElementById(id);
        if (element) element.remove();
    }

    updatePriseData(topic, message) {
        const priseKey = Object.keys(this.prises).find(key => topic.includes(this.prises[key].id));
        if (!priseKey) return;

        try {
            const data = JSON.parse(message);
            const priseDiv = document.getElementById(priseKey);
            if (!priseDiv) return;

            if (data.result && typeof data.result.on === "boolean") {
                priseDiv.querySelector(".state").textContent = data.result.on ? "Allumée" : "Éteinte";
            }

            if (data.apower !== undefined || data.total !== undefined) {
                priseDiv.querySelector(".power").textContent = data.apower || "-";
                priseDiv.querySelector(".energy").textContent = (data.total / 1000).toFixed(3);
                priseDiv.querySelector(".date").textContent = new Date(data.minute_ts * 1000).toLocaleString("fr-FR");
            }
        } catch (err) {
            console.error("Erreur JSON:", err);
        }
    }
}

// --- Classe PriseManager ---
class PriseManager {
    constructor() {
        this.listeIDs = [];
        this.apiUrl = 'http://localhost:3000';
    }

    ajouterPrise() {
        const valeurId = document.getElementById('input-id').value.trim();
        const nomPrise = document.getElementById('input-nom').value.trim();
        const localite = document.getElementById('input-localite').value.trim();

        if (!valeurId || !nomPrise || !localite) {
            alert('Veuillez remplir tous les champs.');
            return;
        }

        fetch(`${this.apiUrl}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valeur_id: valeurId, nom_prise: nomPrise, localite: localite })
        })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            this.chargerIDs();
            this.chargerPrisesConsultation();
            if (window.shellyManager) window.shellyManager.refreshPrisesFromAPI();
        })
        .catch(err => console.error('Erreur ajout:', err));
    }

    supprimerID() {
        const select = document.getElementById('select-ids');
        const id = select.value;
        if (!id) return alert('Veuillez choisir une prise à supprimer.');

        if (!confirm('Confirmer la suppression ?')) return;

        fetch(`${this.apiUrl}/delete/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            this.chargerIDs();
            this.chargerPrisesConsultation();
            if (window.shellyManager) window.shellyManager.refreshPrisesFromAPI();
        })
        .catch(err => console.error('Erreur suppression:', err));
    }

    modifierPrise() {
        const select = document.getElementById('select-ids');
        const id = select.value;
        const nom = document.getElementById('nouveau-nom').value.trim();
        const localite = document.getElementById('nouvelle-localite').value.trim();

        if (!id || !nom || !localite) {
            alert('Veuillez remplir les champs de modification.');
            return;
        }

        fetch(`${this.apiUrl}/update/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nom_prise: nom, localite: localite })
        })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            this.chargerIDs();
            this.chargerPrisesConsultation();
            if (window.shellyManager) window.shellyManager.refreshPrisesFromAPI();
        })
        .catch(err => console.error('Erreur modification:', err));
    }

    chargerIDs() {
        fetch(`${this.apiUrl}/ids`)
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById('select-ids');
            select.innerHTML = '';
            this.listeIDs = data;

            data.forEach(prise => {
                const option = document.createElement('option');
                option.value = prise.id;
                option.textContent = `${prise.nom_prise} (${prise.valeur_id}) - ${prise.localite}`;
                select.appendChild(option);
            });
        });
    }

    chargerPrisesConsultation() {
        fetch(`${this.apiUrl}/ids`)
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById('consultation-select');
            select.innerHTML = '<option value="">-- Sélectionnez une prise --</option>';
            data.forEach(prise => {
                const option = document.createElement('option');
                option.value = prise.id;
                option.textContent = `${prise.nom_prise} (${prise.valeur_id}) - ${prise.localite}`;
                select.appendChild(option);
            });
        });
    }

    afficherDetailsConsultation(event) {
        const id = event.target.value;
        const prise = this.listeIDs.find(p => p.id == id);
        const infoDiv = document.getElementById('info-prise');

        if (prise) {
            infoDiv.innerHTML = `
                <strong>Nom:</strong> ${prise.nom_prise}<br>
                <strong>ID:</strong> ${prise.valeur_id}<br>
                <strong>Localité:</strong> ${prise.localite}
            `;
        } else {
            infoDiv.innerHTML = '';
        }
    }

    initialiser() {
        this.chargerIDs();
        this.chargerPrisesConsultation();
        document.getElementById('consultation-select')
            .addEventListener('change', this.afficherDetailsConsultation.bind(this));
    }
}

// Initialisation globale
const shellyManager = new ShellyManager();
window.shellyManager = shellyManager;

const priseManager = new PriseManager();
window.onload = () => priseManager.initialiser();
window.ajouterPrise = () => priseManager.ajouterPrise();
window.supprimerID = () => priseManager.supprimerID();
window.modifierPrise = () => priseManager.modifierPrise();
