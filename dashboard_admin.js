// ——————————————
// Classe PriseManager — Gère CRUD + affichage + lien avec ShellyManager
// ——————————————
class PriseManager {
    constructor(shellyManagerInstance) {
        this.liste = [];// Contient la liste des prises récupérées depuis l'API
        this.selection = null; // Contient la prise actuellement sélectionnée
        this.apiUrl = 'http://localhost:3000'; // Adresse de l’API Node.js
        this.shellyManager = shellyManagerInstance; // Référence vers l’instance ShellyManager
    }

    // Récupère la liste des prises depuis l’API et les affiche dynamiquement dans la liste HTML
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
    // Affiche les détails d’une prise sélectionnée
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

    // Efface les détails affichés et réinitialise la sélection
    clearDetails() {
        document.getElementById('prise-details').innerHTML = '';
        this.selection = null;
    }

    // Initialise tous les écouteurs d’événements pour les boutons d’ajout, de suppression et de modification
    initListeners() {
        document.getElementById('prise-list').addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                this.afficherDetails(e.target.getAttribute('data-id'));
            }
        });

        // Bouton d’ajout de prise
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
            
                // Réinitialiser les champs de formulaire
                document.getElementById('prise-name').value = '';
                document.getElementById('prise-locality').value = '';
                document.getElementById('prise-id').value = '';
            })            
            .catch(err => console.error('Erreur POST /add :', err));
        });

        // Bouton de mise à jour des informations d’une prise
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

        // Bouton de mise à jour des informations d’une prise
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
            
                // Réinitialiser les champs de modification
                document.getElementById('nouveau-nom').value = '';
                document.getElementById('nouvelle-localite').value = '';
            })
            
            .catch(err => console.error('Erreur PUT /update/:id :', err));
        });
    }

    // Initialise l'application (écouteurs + chargement des prises)
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
        // URL de base de l’API REST (ton backend Express)
        this.apiUrl = 'http://localhost:3000';

        // Ces champs seront remplis dynamiquement via /mqtt-config
        this.mqttBroker = null;
        this.mqttOptions = null;

        // Client MQTT (géré par mqtt.js)
        this.client = null;

        // Dictionnaire des prises supervisées : { idPrise: { ... } }
        this.prises = {};
    }

    // Initialise la connexion MQTT après avoir récupéré la config depuis l’API
    async initMQTT() {
        try {
            // Appelle le backend pour obtenir les infos MQTT depuis .env
            const config = await fetch(`${this.apiUrl}/mqtt-config`).then(res => res.json());

            // Remplit les données de connexion MQTT avec celles récupérées
            this.mqttBroker = config.mqttBroker;
            this.mqttOptions = {
                clientId: "web_client_" + Math.random().toString(16).substr(2, 8), // ID unique
                username: config.username,
                password: config.password,
                protocol: config.protocol
            };

            // Connexion au broker via mqtt.js
            this.client = mqtt.connect(this.mqttBroker, this.mqttOptions);

            // Callback en cas de connexion réussie
            this.client.on('connect', () => {
                console.log('✅ Connecté au broker MQTT');
                document.getElementById('status').textContent = 'Connecté';
            });

            // Quand un message est reçu, on le transmet à la méthode de traitement
            this.client.on('message', (topic, message) => {
                this.updatePriseData(topic, message);
            });

            // Callback en cas d’erreur de connexion
            this.client.on('error', err => {
                console.error('❌ Erreur MQTT :', err);
                document.getElementById('status').textContent = 'Erreur MQTT';
            });

        } catch (err) {
            console.error("❌ Impossible de charger la config MQTT :", err);
        }
    }

    // Charge les prises depuis l’API REST et les ajoute à l’interface
    loadPrisesFromAPI() {
        fetch(`${this.apiUrl}/ids`)
            .then(r => r.json())
            .then(data => {
                data.forEach(({ valeur_id, nom_prise, localite }) => {
                    if (!this.prises[valeur_id]) {
                        this.addPrise(nom_prise, localite, valeur_id);

                        // Souscrit aux topics nécessaires pour cette prise
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/rpc`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/status`);
                        this.client.subscribe(`shellyplusplugs-${valeur_id}/test`);
                    }
                });
            })
            .catch(console.error);
    }

    // Ajoute dynamiquement une prise dans le DOM
    addPrise(name, locality, id) {
        this.prises[id] = { id };
        const container = document.getElementById('prises-container');
        const div = document.createElement('div');
        div.classList.add('prise');
        div.id = id;

        // Affichage HTML d’une prise
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

    // Supprime une prise visuellement et l’éteint côté MQTT
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

    // Envoie une commande MQTT pour allumer ou éteindre une prise
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

    // Initialise les écouteurs d’événements sur les boutons allumer/éteindre
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

    // Traite les messages reçus du broker MQTT
    updatePriseData(topic, message) {
        const priseKey = Object.keys(this.prises).find(key => topic.includes(this.prises[key].id));
        if (!priseKey) return;

        try {
            const data = JSON.parse(message);
            const div = document.getElementById(priseKey);

            // Mise à jour de l'état (on/off)
            if (topic.endsWith('/status') && data.status) {
                const state = data.status === 'on' ? 'Allumé' : 'Éteint';
                const stateSpan = div.querySelector('.state');
                stateSpan.textContent = state;
                stateSpan.style.color = data.status === 'on' ? 'green' : 'red';
            }

            // Mise à jour des valeurs de puissance et énergie
            if (data.apower !== undefined || data.total !== undefined) {
                div.querySelector(".power").textContent = data.apower ?? "-";
                div.querySelector(".energy").textContent = data.total !== undefined ? (data.total / 1000).toFixed(3) : "-";
            }
        } catch (err) {
            console.error('Erreur de réception Shelly :', err);
        }
    }

    // Met à jour la date de dernière interaction
    updateLastUpdated(id, timestamp) {
        const div = document.getElementById(id);
        const dateEl = div.querySelector('.date');
        if (dateEl) dateEl.textContent = timestamp;
    }

    // Lance tous les composants nécessaires à la supervision
    async initialiser() {
        this.initShellyListeners();   // Boutons
        await this.initMQTT();        // Connexion MQTT
        this.loadPrisesFromAPI();     // Chargement depuis la BDD
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


// =============================
// Gestion des onglets et du thème
// =============================

// Fonction pour ouvrir un onglet en affichant son contenu
function openTab(tabId) {
  // On désactive tous les contenus d'onglets visibles
  document.querySelectorAll(".tab-content").forEach(div => 
    div.classList.remove("active")
  );

  // On désactive tous les boutons d'onglets
  document.querySelectorAll(".tablink").forEach(btn => 
    btn.classList.remove("active")
  );

  // On active le contenu de l'onglet demandé
  document.getElementById(tabId).classList.add("active");

  // On active le bouton actuellement cliqué
  event.currentTarget.classList.add("active");
}

// =============================
// Accessibilité : ajustement de la taille du texte
// =============================

let fontSizePct = 100;  // Taille de base à 100%

// Augmenter la taille du texte
document.getElementById("increase-text").addEventListener("click", () => {
  fontSizePct += 10;  // Incrémente de 10%
  document.documentElement.style.fontSize = fontSizePct + "%";  // Applique au root (html)
});

// Réduire la taille du texte (min 50%)
document.getElementById("decrease-text").addEventListener("click", () => {
  fontSizePct = Math.max(50, fontSizePct - 10);  // Empêche de descendre en dessous de 50%
  document.documentElement.style.fontSize = fontSizePct + "%";
});

// =============================
// Thème clair/sombre
// =============================

// Bascule entre les thèmes en ajoutant/enlevant la classe "dark" sur le <body>
document.getElementById("toggle-theme").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});


// ===============================================
// Gestionnaire d'événement : mise à jour du prix au kWh
// ===============================================

// Lorsque l'utilisateur clique sur le bouton avec l'ID "update-price-btn"
document
  .getElementById("update-price-btn")
  .addEventListener("click", function () {
    
    // On récupère et convertit la valeur entrée dans le champ "prix-kwh"
    const prixKwh = parseFloat(document.getElementById("prix-kwh").value);

    // Sélection de l'élément HTML pour afficher les messages à l'utilisateur
    const messageElement = document.getElementById("update-price-message");

    // -----------------------------
    // Vérification de la validité du prix saisi
    // -----------------------------
    if (isNaN(prixKwh) || prixKwh <= 0) {
      messageElement.style.display = "block";           // On rend visible le message
      messageElement.style.color = "red";               // En rouge car c'est une erreur
      messageElement.textContent = "Le prix doit être un nombre supérieur à 0.";
      return;                                            // On arrête l'exécution ici
    }

    // -----------------------------
    // Envoi de la requête POST à l’API pour mettre à jour le prix
    // -----------------------------
    fetch("https://api.recharge.cielnewton.fr/update-kwh-price", {
      method: "POST",                                    // Méthode POST car on modifie des données
      headers: {
        "Content-Type": "application/json",              // Spécifie qu'on envoie du JSON
      },
      body: JSON.stringify({ prix_kwh: prixKwh }),       // Corps de la requête : { prix_kwh: ... }
    })
      .then((response) => response.json())               // On parse la réponse JSON

      .then((data) => {
        // -----------------------------
        // Traitement de la réponse
        // -----------------------------
        if (data.success) {
          // Si l'API confirme que la mise à jour a réussi
          messageElement.style.display = "block";
          messageElement.style.color = "green";          // En vert pour signaler le succès
          messageElement.textContent = data.message;     // Affiche le message retourné par l'API
        } else {
          // Sinon, erreur retournée par l'API
          messageElement.style.display = "block";
          messageElement.style.color = "red";
          messageElement.textContent =
            data.error || "Erreur lors de la mise à jour du prix.";
        }
      })

      .catch((error) => {
        // -----------------------------
        // Gestion des erreurs réseau ou serveur
        // -----------------------------
        messageElement.style.display = "block";
        messageElement.style.color = "red";
        messageElement.textContent =
          "Erreur de serveur. Veuillez réessayer plus tard.";

        // Affiche le détail de l’erreur dans la console pour débogage
        console.error("Erreur:", error);
      });
  });


// ===============================
// Écouteur d'événements pour le bouton de déconnexion
// ===============================

// On récupère le bouton ayant l’ID "logoutBtn" et on y attache un écouteur d’événement
document.getElementById("logoutBtn").addEventListener("click", () => {
  
  // Lors du clic, on envoie une requête GET à l’API de déconnexion
  fetch("https://api.recharge.cielnewton.fr/logout", {
    method: "GET",
    credentials: "include", // Important : permet d’envoyer automatiquement les cookies (ex. : token de session)
  })
    // On attend la réponse de l’API au format JSON
    .then((response) => response.json())

    // Traitement de la réponse
    .then((data) => {
      if (data.redirect) {
        // Si la réponse contient une URL de redirection (ex. : page de login),
        // on redirige l’utilisateur automatiquement vers cette page
        window.location.href = data.redirect;
      }
    })

    // En cas d’erreur réseau ou de serveur, on affiche l’erreur dans la console
    .catch((error) => console.error("Erreur lors de la déconnexion :", error));
});


// ===============================
// Fonction pour afficher les prises connectées
// ===============================

// async function afficherPrisesConnectees() {
//     // Récupère l'élément HTML où afficher la liste des prises
//     const container = document.getElementById("prises-connectees");

//     // Affiche un message temporaire pendant le chargement
//     container.innerHTML = "Chargement...";

//     try {
//       // Envoie une requête GET à l'API pour récupérer les prises connectées
//       const response = await fetch("/prises-connectees", {
//         credentials: "include", // Inclut les cookies/session si nécessaire (utile pour l’authentification)
//       });

//       // Si la réponse n'est pas correcte (ex: code 500, 404...), lève une erreur
//       if (!response.ok) throw new Error("Erreur API");

//       // Parse la réponse JSON pour obtenir un tableau d’objets "prise"
//       const prises = await response.json();

//       // Si aucune prise connectée, affiche un message
//       if (prises.length === 0) {
//         container.innerHTML = "Aucune prise connectée.";
//         return;
//       }

//       // Construit dynamiquement la liste HTML des prises
//       let html = "<ul>";
//       prises.forEach((prise) => {
//         html += `<li>
//           <strong>${prise.nom_prise} (${prise.localite})</strong> - Connectée par : ${
//           prise.user ? prise.user.nom || prise.user.email : "Inconnu"
//         }
//         </li>`;
//       });
//       html += "</ul>";

//       // Injecte le HTML généré dans le conteneur
//       container.innerHTML = html;

//     } catch (e) {
//       // En cas d'erreur (réseau, serveur...), affiche un message d'erreur et logue l’erreur dans la console
//       container.innerHTML = "Erreur lors du chargement des prises connectées.";
//       console.error(e);
//     }
//   }

// ===============================
// Initialisation immédiate
// ===============================

// afficherPrisesConnectees(); // Appelle la fonction dès le chargement du script

// ===============================
// Mise à jour automatique toutes les 30 secondes
// ===============================

// setInterval(afficherPrisesConnectees, 30000); // Relance la fonction toutes les 30 secondes

