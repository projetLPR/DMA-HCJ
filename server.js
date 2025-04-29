// Import des modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');

// Création de l'application Express
const app = express();
const PORT = 3000;

// Connexion MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'ciel',
    password: 'ciel', // <-- METS TON MOT DE PASSE MySQL ICI
    database: 'mon_projet'         // <-- Ton nom de base de données
});

// Connexion à la base
db.connect((err) => {
    if (err) {
        console.error('Erreur de connexion MySQL:', err);
        process.exit(1);
    }
    console.log('Connecté à MySQL');
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ROUTES

// Ajouter une prise complète
app.post('/add', (req, res) => {
    const { valeur_id, nom_prise, localite } = req.body;

    if (!valeur_id || !nom_prise || !localite) {
        return res.status(400).json({ message: 'Champs manquants' });
    }

    const sql = "INSERT INTO ids (valeur_id, nom_prise, localite) VALUES (?, ?, ?)";
    db.query(sql, [valeur_id, nom_prise, localite], (err, result) => {
        if (err) {
            console.error('Erreur SQL (ajout):', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json({ message: 'Prise ajoutée avec succès' });
    });
});


// Récupérer tous les IDs
app.get('/ids', (req, res) => {
    const sql = "SELECT * FROM ids";
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Erreur SQL (récupération):', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json(results);
    });
});

// Supprimer un ID par son ID numérique
app.delete('/delete/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM ids WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Erreur SQL (suppression):', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json({ message: 'ID supprimé avec succès' });
    });
});

// Modifier une prise
app.put('/update/:id', (req, res) => {
    const id = req.params.id;
    const { valeur_id, nom_prise, localite } = req.body;

    if (!valeur_id || !nom_prise || !localite) {
        return res.status(400).json({ message: 'Champs manquants pour la mise à jour' });
    }

    const sql = "UPDATE ids SET valeur_id = ?, nom_prise = ?, localite = ? WHERE id = ?";
    db.query(sql, [valeur_id, nom_prise, localite, id], (err, result) => {
        if (err) {
            console.error('Erreur SQL (update):', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json({ message: 'Prise mise à jour avec succès' });
    });
});


// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur Node.js en écoute sur http://localhost:${PORT}`);
});
