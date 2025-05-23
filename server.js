
// server.js
const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
require('dotenv').config();

const app  = express();
const port = 3000;

// --------------------
// 1. Middleware
// --------------------
app.use(cors());
app.use(express.json()); // remplace body-parser

// --------------------
// 2. Connexion MySQL
// --------------------
const db = mysql.createConnection({
  host:     process.env.MYSQL_HOST,
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});
console.log('MySQL Config:', {
  host:     process.env.MYSQL_HOST,
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});
db.connect(err => {
  if (err) {
    console.error('❌ Erreur de connexion MySQL:', err);
    process.exit(1);
  }
  console.log('✅ Connecté à MySQL');
});

// --------------------
// 3. Routes CRUD
// --------------------

// 3.1. Lire toutes les prises
// Renvoie un tableau d’objets { id, valeur_id, nom_prise, localite }
app.get('/ids', (req, res) => {
  const sql = 'SELECT id, valeur_id, nom_prise, localite FROM ids';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erreur SQL (lecture) :', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json(results);
  });
});

// 3.2. Ajouter une prise
// Attend { valeur_id, nom_prise, localite } en JSON, renvoie { message }
app.post('/add', (req, res) => {
  const { valeur_id, nom_prise, localite } = req.body;
  if (!valeur_id || !nom_prise || !localite) {
    return res.status(400).json({ message: 'Champs manquants' });
  }
  const sql = 'INSERT INTO ids (valeur_id, nom_prise, localite) VALUES (?, ?, ?)';
  db.query(sql, [valeur_id, nom_prise, localite], err => {
    if (err) {
      console.error('Erreur SQL (ajout) :', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json({ message: 'Prise ajoutée avec succès' });
  });
});

// 3.3. Mettre à jour une prise
// Paramètre URL : l’ID de table (champ `id`), body { nom_prise, localite }
app.put('/update/:id', (req, res) => {
  const id = req.params.id;
  const { nom_prise, localite } = req.body;
  if (!nom_prise || !localite) {
    return res.status(400).json({ message: 'Champs de modification manquants' });
  }
  const sql = 'UPDATE ids SET nom_prise = ?, localite = ? WHERE id = ?';
  db.query(sql, [nom_prise, localite, id], err => {
    if (err) {
      console.error('Erreur SQL (modification) :', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json({ message: 'Prise modifiée avec succès' });
  });
});

// 3.4. Supprimer une prise
// Paramètre URL : l’ID de table (champ `id`)
app.delete('/prises/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM ids WHERE id = ?';
  db.query(sql, [id], err => {
    if (err) {
      console.error('Erreur SQL (suppression) :', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json({ message: 'Prise supprimée avec succès' });
  });
});

// 3.5. Route pour exposer les variables front-end
app.get('/mqtt-config', (req, res) => {
  res.json({
    mqttBroker: process.env.MQTT_BROKER_URL,
    username: process.env.MQTT_BROKER_USERNAME,
    password: process.env.MQTT_BROKER_PASSWORD,
    protocol: process.env.MQTT_BROKER_PROTOCOL
    
  });
});
console.log('MQTT config:', {
  broker: process.env.MQTT_BROKER_URL,
  user: process.env.MQTT_BROKER_USERNAME,
  pass: process.env.MQTT_BROKER_PASSWORD,
  proto: process.env.MQTT_BROKER_PROTOCOL
});

// --------------------
// 4. Lancement du serveur
// --------------------
app.listen(port, () => {
  console.log(`🚀 API en écoute sur http://localhost:${port}`);
});
