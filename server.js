const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connexion à la base MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'ciel',
    password: 'ciel',
    database: 'mon_projet'
});

db.connect((err) => {
    if (err) {
        console.error('❌ Erreur de connexion MySQL:', err);
        process.exit(1);
    }
    console.log('✅ Connecté à MySQL');
});

// ➕ Ajouter une prise
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

// 🔄 Modifier une prise
app.put('/update/:id', (req, res) => {
    const { id } = req.params;
    const { nom_prise, localite } = req.body;

    if (!nom_prise || !localite) {
        return res.status(400).json({ message: 'Champs de modification manquants' });
    }

    const sql = "UPDATE ids SET nom_prise = ?, localite = ? WHERE id = ?";
    db.query(sql, [nom_prise, localite, id], (err, result) => {
        if (err) {
            console.error('Erreur SQL (modification):', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json({ message: 'Prise modifiée avec succès' });
    });
});

// ❌ Supprimer une prise
app.delete('/delete/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM ids WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Erreur SQL (suppression):', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json({ message: 'Prise supprimée avec succès' });
    });
});

// 📄 Récupérer toutes les prises
app.get('/ids', (req, res) => {
    const sql = "SELECT * FROM ids";
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Erreur SQL (lecture):', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
        res.json(results);
    });
});

// 🚀 Lancer le serveur
app.listen(port, () => {
    console.log(`🚀 Serveur en écoute sur http://localhost:${port}`);
});
