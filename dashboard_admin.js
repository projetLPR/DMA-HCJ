// ——————————————
// Classe PriseManager — Gère CRUD + affichage + lien avec ShellyManager
// ——————————————
class PriseManager {
    constructor(shellyManagerInstance) {
        this.liste = [];
        this.selection = null;
        this.apiUrl = 'http://localhost:3000';
        this.shellyManager = shellyManagerInstance;
    }

    chargerListe() {
        fetch(`${this.apiUrl}/ids`)
          .then(res => res.json())
          .then(data => {
            this.liste = data;
            const ul = document.getElementById('prise-list');
            ul.innerHTML = '';
            data.forEach(p => {
              const li = document.createElement('li');
              li.innerHTML = `<button data-id="${p.id}">
                                ${p.nom_prise} (${p.valeur_id}) - ${p.localite}
                              </button><br><br>`;
              ul.appendChild(li);
            });
          })
          .catch(err => console.error('Erreur GET /ids :', err));
    }

    afficherDetails(id) {
        const p = this.liste.find(x => String(x.id) === String(id));
        if (!p) return;
        this.selection = p;
        const d = document.getElementById('prise-details');
        d.innerHTML = `
            <h3>Détails de la prise</h3>
            <p><strong>Nom :</strong> ${p.nom_prise}</p>
            <p><strong>valeur_id :</strong> ${p.valeur_id}</p>
            <p><strong>Localité :</strong> ${p.localite}</p>
            <p><strong>ID table :</strong> ${p.id}</p>
        `;
    }

    clearDetails() {
        document.getElementById('prise-details').innerHTML = '';
        this.selection = null;
    }

    initListeners() {
        document.getElementById('prise-list').addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                this.afficherDetails(e.target.getAttribute('data-id'));
            }
        });

                // Ajouts champs
        document.getElementById('add-prise-btn').addEventListener('click', () => {
            const nom = document.getElementById('prise-name').value.trim();
            const loc = document.getElementById('prise-locality').value.trim();
            const vid = document.getElementById('prise-id').value.trim();
            if (!nom || !loc || !vid) return alert('Veuillez remplir tous les champs');

            fetch(`${this.apiUrl}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valeur_id: vid, nom_prise: nom, localite: loc })
            })
            .then(r => r.json())
            .then(j => {
                alert(j.message);
                this.clearDetails();
                this.chargerListe();
                this.shellyManager.addPrise(nom, loc, vid);
            
                // Nettoyer les champs
                document.getElementById('prise-name').value = '';
                document.getElementById('prise-locality').value = '';
                document.getElementById('prise-id').value = '';
            })            
            .catch(err => console.error('Erreur POST /add :', err));
        });

                // Suppression champs
        document.getElementById('delete-prise-btn').addEventListener('click', () => {
            if (!this.selection) return alert('Veuillez sélectionner une prise');
            if (!confirm('Confirmer la suppression ?')) return;

            fetch(`${this.apiUrl}/prises/${this.selection.id}`, { method: 'DELETE' })
            .then(r => {
                if (!r.ok) throw new Error("Échec de la suppression");
                return r.json();
            })
            .then(j => {
                alert(j.message || "Prise supprimée avec succès");
                this.shellyManager.removePrise(this.selection.valeur_id);
                this.clearDetails();
                this.chargerListe();
            })
            .catch(err => alert("Erreur lors de la suppression : " + err.message));            
        });

                // Modification champs
        document.getElementById('update-prise-btn').addEventListener('click', () => {
            if (!this.selection) return alert('Veuillez sélectionner une prise');
            const nom = document.getElementById('nouveau-nom').value.trim();
            const loc = document.getElementById('nouvelle-localite').value.trim();
            if (!nom || !loc) return alert('Veuillez remplir tous les champs');

            fetch(`${this.apiUrl}/update/${this.selection.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nom_prise: nom, localite: loc })
            })
            .then(r => r.json())
            .then(j => {
                alert(j.message);
                this.clearDetails();
                this.chargerListe();
            
                // Nettoyer les champs de modification
                document.getElementById('nouveau-nom').value = '';
                document.getElementById('nouvelle-localite').value = '';
            })
            
            .catch(err => console.error('Erreur PUT /update/:id :', err));
        });
    }

    initialiser() {
        this.initListeners();
        this.chargerListe();
    }
}

// ——————————————
// Classe ShellyManager — Gère MQTT + supervision dynamique
// ——————————————
class ShellyManager {
    constructor() {
        this.apiUrl = 'http://localhost:3000';
        this.mqttBroker = "wss://47567f9a74b445e6bef394abec5c83a1.s1.eu.hivemq.cloud:8884/mqtt";
        this.mqttOptions = {
            clientId: "web_client_" + Math.random().toString(16).substr(2, 8),
            username: "ShellyPlusPlugS",
            password: "Ciel92110",
            protocol: "wss"
        };
        this.client = null;
        this.prises = {};
    }

    initMQTT() {
        this.client = mqtt.connect(this.mqttBroker, this.mqttOptions);

        this.client.on('connect', () => {
            console.log('✅ Connecté au broker MQTT');
            document.getElementById('status').textContent = 'Connecté';
        });

        this.client.on('message', (topic, message) => {
            this.updatePriseData(topic, message);
        });

        this.client.on('error', err => {
            console.error('❌ Erreur MQTT :', err);
            document.getElementById('status').textContent = 'Erreur MQTT';
        });
    }

    loadPrisesFromAPI() {
        fetch(`${this.apiUrl}/ids`)
            .then(r => r.json())
            .then(data => {
                data.forEach(({ valeur_id, nom_prise, localite }) => {
                    if (!this.prises[valeur_id]) {
                        this.addPrise(nom_prise, localite, valeur_id);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/rpc`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/status`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/test`);
                    }
                });
            })
            .catch(console.error);
    }

    addPrise(name, locality, id) {
        this.prises[id] = { id };
        const container = document.getElementById('prises-container');
        const div = document.createElement('div');
        div.classList.add('prise');
        div.id = id;
        div.innerHTML = `
            <h2>${name} - <em>${locality}</em></h2>
            <p><strong>ID :</strong> ${id}</p>
            <p><strong>État :</strong> <span class="state">-</span></p>
            <p><strong>Puissance :</strong> <span class="power">-</span> W</p>
            <p><strong>Énergie :</strong> <span class="energy">-</span> kWh</p>
            <p><strong>Dernière mise à jour :</strong> <span class="date">-</span></p>
            <button class="turnOn">Allumer</button>
            <button class="turnOff">Éteindre</button>
        `;
        container.appendChild(div);
    }

      // Supprime une prise de l’affichage et envoie une commande d’arrêt avant suppression
    removePrise(id) {
        const payload = {
            id: 1,
            src: "web_client",
            method: "Switch.Set",
            params: { id: 0, on: false }
        };

        this.client.publish(
            `shellyplusplugs-${id}/rpc`,
            JSON.stringify(payload),
            {},
            (err) => {
                if (err) {
                    console.error(`Erreur d'extinction de la prise ${id}`, err);
                } else {
                    console.log(`Prise ${id} éteinte avant suppression`);
                }

                const div = document.getElementById(id);
                if (div) div.remove();
                delete this.prises[id];
            }
        );
    }

    togglePrise(id, turnOn) {
        const payload = {
            id: 1,
            src: "web_client",
            method: "Switch.Set",
            params: { id: 0, on: turnOn }
        };

        this.client.publish(
            `shellyplusplugs-${id}/rpc`,
            JSON.stringify(payload)
        );

        this.updateLastUpdated(id, new Date().toLocaleString());
    }

    initShellyListeners() {
        document.getElementById('prises-container')
            .addEventListener('click', e => {
                const btn = e.target;
                const id = btn.closest('.prise')?.id;
                if (!id) return;

                if (btn.classList.contains('turnOn')) {
                    this.togglePrise(id, true);
                } else if (btn.classList.contains('turnOff')) {
                    this.togglePrise(id, false);
                }
            });
    }

    updatePriseData(topic, message) {
        const priseKey = Object.keys(this.prises).find(key => topic.includes(this.prises[key].id));
        if (!priseKey) return;

        try {
            const data = JSON.parse(message);
            const div = document.getElementById(priseKey);

            if (topic.endsWith('/status') && data.status) {
                const state = data.status === 'on' ? 'Allumé' : 'Éteint';
                const stateSpan = div.querySelector('.state');
                stateSpan.textContent = state;
                stateSpan.style.color = data.status === 'on' ? 'green' : 'red';
            }

            if (data.apower !== undefined || data.total !== undefined) {
                div.querySelector(".power").textContent = data.apower ?? "-";
                div.querySelector(".energy").textContent = data.total !== undefined ? (data.total / 1000).toFixed(3) : "-";
            }
        } catch (err) {
            console.error('Erreur de réception Shelly :', err);
        }
    }

    updateLastUpdated(id, timestamp) {
        const div = document.getElementById(id);
        const dateEl = div.querySelector('.date');
        if (dateEl) dateEl.textContent = timestamp;
    }

    initialiser() {
        this.initShellyListeners();
        this.initMQTT();
        this.loadPrisesFromAPI();
    }
}

// ——————————————
// Initialisation au chargement
// ——————————————
document.addEventListener('DOMContentLoaded', () => {
    const shellyManager = new ShellyManager();
    shellyManager.initialiser();

    const priseManager = new PriseManager(shellyManager);
    priseManager.initialiser();
});


// Reprise de la logique des onglets et du thème
    function openTab(tabId) {
      document.querySelectorAll(".tab-content").forEach(div => div.classList.remove("active"));
      document.querySelectorAll(".tablink").forEach(btn => btn.classList.remove("active"));
      document.getElementById(tabId).classList.add("active");
      event.currentTarget.classList.add("active");
    }

    let fontSizePct = 100;
    document.getElementById("increase-text").addEventListener("click", () => {
      fontSizePct += 10;
      document.documentElement.style.fontSize = fontSizePct + "%";
    });
    document.getElementById("decrease-text").addEventListener("click", () => {
      fontSizePct = Math.max(50, fontSizePct - 10);
      document.documentElement.style.fontSize = fontSizePct + "%";
    });
    document.getElementById("toggle-theme").addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
