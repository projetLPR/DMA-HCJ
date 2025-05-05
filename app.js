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
      document.getElementById("status").textContent =
        "❌ Erreur de connexion MQTT";
      this.client.end();
    });

    this.client.on("offline", () => {
      console.log("❌ Broker MQTT hors ligne !");
      document.getElementById("status").textContent = "❌ Hors ligne";
    });

    this.client.on("close", () => {
      console.log("❌ Connexion fermée au broker MQTT");
      document.getElementById("status").textContent = "❌ Connexion fermée";
    });
  }

  /** Ajoute un événement sur le bouton "Ajouter une prise" */
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
    } else {
      console.error("❌ Bouton 'Ajouter une prise' non trouvé !");
    }
  }

  /** Ajoute une prise dynamiquement */
  addPrise(name, locality, id) {
    if (this.prises[id]) {
      alert("Cette prise existe déjà !");
      return;
    }

    this.prises[id] = { name, locality, id };

    const container = document.getElementById("prises-container");
    const priseDiv = document.createElement("div");
    priseDiv.classList.add("prise");
    priseDiv.id = id;
    priseDiv.innerHTML = `
      <h2>${name} - <em>${locality}</em></h2>
      <p><strong>ID de la prise :</strong> <span class="data topic-id">${id}</span></p>
      <p><strong>État :</strong> <span class="data state">-</span></p>
      <p><strong>Puissance :</strong> <span class="data power">-</span> W</p>
      <p><strong>Consommation :</strong> <span class="data energy">0.000</span> kWh</p>
      <p><strong>Date :</strong> <span class="data date">-</span></p>
      <button class="turnOn">Allumer</button>
      <button class="turnOff">Éteindre</button>
      <button class="remove-prise">Supprimer</button>
  `;
    container.appendChild(priseDiv);

    // Abonnement au topic de réception de données
    this.client.subscribe(`shellyplusplugs-${id}/test`);

    // Demande immédiate de l'état de la prise
    const requestPayload = {
      id: Date.now(),
      src: "web_client",
      method: "Switch.Get",
      params: { id: 0 },
    };
    this.client.publish(
      `shellyplusplugs-${id}/rpc`,
      JSON.stringify(requestPayload)
    );

    // Boutons
    priseDiv
      .querySelector(".turnOn")
      .addEventListener("click", () => this.togglePrise(id, true));
    priseDiv
      .querySelector(".turnOff")
      .addEventListener("click", () => this.togglePrise(id, false));
    priseDiv
      .querySelector(".remove-prise")
      .addEventListener("click", () => this.removePrise(id));
  }

  /** Envoie une commande MQTT pour allumer/éteindre la prise */
  togglePrise(id, turnOn) {
    const payload = {
      id: 1,
      src: "web_client",
      method: "Switch.Set",
      params: { id: 0, on: turnOn },
    };

    this.client.publish(`shellyplusplugs-${id}/rpc`, JSON.stringify(payload));
    console.log(
      `Commande envoyée à shellyplusplugs-${id}: ${
        turnOn ? "Allumer" : "Éteindre"
      }`
    );

    // ➕ Mise à jour directe de l'état dans l'interface
    const priseDiv = document.getElementById(id);
    if (priseDiv) {
      priseDiv.querySelector(".state").textContent = turnOn
        ? "Allumée"
        : "Éteinte";
      priseDiv.querySelector(".date").textContent = new Date().toLocaleString(
        "fr-FR"
      );
    }
  }

  /** Supprime une prise */
  removePrise(id) {
    if (!this.prises[id]) {
      console.warn(`Prise ${id} introuvable.`);
      return;
    }

    // Éteindre la prise avant de la supprimer
    this.togglePrise(id, false);

    // Désabonnement du topic de la prise
    this.client.unsubscribe(`shellyplusplugs-${id}/test`);
    delete this.prises[id];

    const priseElement = document.getElementById(id);
    if (priseElement) {
      priseElement.remove();
      console.log(`Prise ${id} supprimée.`);
    }
  }

  /** Met à jour les données reçues de MQTT */
  updatePriseData(topic, message) {
    const priseKey = Object.keys(this.prises).find((key) =>
      topic.includes(this.prises[key].id)
    );
    if (!priseKey) return;

    try {
      const data = JSON.parse(message);
      const priseDiv = document.getElementById(priseKey);

      // Affichage de l’état
      if (data.result && typeof data.result.on === "boolean") {
        priseDiv.querySelector(".state").textContent = data.result.on
          ? "Allumée"
          : "Éteinte";
      }

      // Si ce sont des données de consommation
      if (
        data.apower !== undefined ||
        data.current !== undefined ||
        data.total !== undefined
      ) {
        priseDiv.querySelector(".power").textContent = data.apower || "-";
        priseDiv.querySelector(".current").textContent = data.current || "-";
        priseDiv.querySelector(".energy").textContent =
          (data.total / 1000).toFixed(3) || "0.000";
        priseDiv.querySelector(".date").textContent = new Date(
          data.minute_ts * 1000
        ).toLocaleString("fr-FR");
      }
    } catch (err) {
      console.error("❌ Erreur JSON:", err);
    }
  }
}

document
  .getElementById("update-price-btn")
  .addEventListener("click", function () {
    const prixKwh = parseFloat(document.getElementById("prix-kwh").value);
    const messageElement = document.getElementById("update-price-message");

    // Vérification de la validité du prix
    if (isNaN(prixKwh) || prixKwh <= 0) {
      messageElement.style.display = "block";
      messageElement.style.color = "red";
      messageElement.textContent = "Le prix doit être un nombre supérieur à 0.";
      return;
    }

    // Envoi de la requête POST pour mettre à jour le prix
    fetch("https://api.recharge.cielnewton.fr/update-kwh-price", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prix_kwh: prixKwh }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          messageElement.style.display = "block";
          messageElement.style.color = "green";
          messageElement.textContent = data.message; // Message de succès
        } else {
          messageElement.style.display = "block";
          messageElement.style.color = "red";
          messageElement.textContent =
            data.error || "Erreur lors de la mise à jour du prix.";
        }
      })
      .catch((error) => {
        messageElement.style.display = "block";
        messageElement.style.color = "red";
        messageElement.textContent =
          "Erreur de serveur. Veuillez réessayer plus tard.";
        console.error("Erreur:", error);
      });
  });

/** Instanciation de la classe pour démarrer l'application */
document.addEventListener("DOMContentLoaded", () => {
  new ShellyManager();
});
