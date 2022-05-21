const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0piwj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function jwtVerify(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next()
    });
}
async function run() {

    try {
        await client.connect();
        const serviceCollection = client.db('Doctors-Portal').collection('services');
        const bookingCollection = client.db('Doctors-Portal').collection('booking');
        const userCollection = client.db('Doctors-Portal').collection('users');


        //get all services
        app.get('/services', async (req, res) => {
            const query = req.body;
            const services = await serviceCollection.find(query).toArray()
            res.send(services)
        })
        //available booking
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 20, 2022';
            const services = await serviceCollection.find().toArray();
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                const bookedSlots = serviceBookings.map(book => book.slot)
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                service.slots = available;
            })
            res.send(services)
        })

        app.get('/booking', jwtVerify, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings)
            } else {
                return res.status(403).send({ message: 'Fobidden access' })
            }
        })

        //book a service
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            else {
                const result = await bookingCollection.insertOne(booking);
                return res.send({ success: true, result });
            }

        })
        //users
        app.get('/users', async(req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.put('/users/admin/:email', jwtVerify, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin'){
                const filter = { email: email };
                const updateDoc = {
                    $set: {role: 'admin'},
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result)
            }else{
                return res.status(403).send('Forbidden access')
            }
        })
        app.get('/admin/:email', async(req, res) => {
            const email = req.params.email;
            const adminRole = await userCollection.findOne({email: email});
            const isAdmin = adminRole.role === 'admin';
            res.send({admin: isAdmin})
        })
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token })
        })
    }
    finally {

    }



}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Hello World')
})
app.listen(port, () => {
    console.log('Listening the port', port);
})