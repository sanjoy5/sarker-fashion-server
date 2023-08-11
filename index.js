const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware 
app.use(cors())
app.use(express.json())

// 2nd Task 
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    // bearer token 
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded
        next()
    })
}






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nuk8vmz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db("sarkerDB").collection("users");
        const productsCollection = client.db("sarkerDB").collection("products");
        const reviewsCollection = client.db("sarkerDB").collection("reviews");
        const cartCollection = client.db("sarkerDB").collection("carts");
        const paymentCollection = client.db("sarkerDB").collection("payments");

        // 1st Task 
        app.post('/jwt', (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            res.send({ token })
        })


        // Warning: use verifyJWT before using verifyAdmin 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }
            next()
        }


        // Users Collection 

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existUser = await usersCollection.findOne(query)
            if (existUser) {
                return res.send({ message: 'User Already exists' })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })




        // Check Admin 
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/users/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.findOne(query)
            res.send(result)
        })



        // Product Colllection 
        app.get('/products', async (req, res) => {
            const result = await productsCollection.find().toArray()
            res.send(result)
        })

        app.post('/products', verifyJWT, verifyAdmin, async (req, res) => {
            const newItem = req.body;
            const result = await productsCollection.insertOne(newItem)
            res.send(result)
        })

        app.delete('/products/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productsCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/updated-product/:id', async (req, res) => {
            const id = req.params.id;

            const objectId = new ObjectId(id);
            let result = await productsCollection.findOne({ _id: objectId });

            if (!result) {
                result = await productsCollection.findOne({ _id: id });
            }

            res.send(result)
        })

        app.put('/updated-product/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const body = req.body;

            const objectId = new ObjectId(id);
            let filter = { _id: objectId };
            const updateProduct = {
                $set: {
                    name: body.name,
                    category: body.category,
                    price: body.price,
                    description: body.description,
                    image: body.image,
                },
            };

            let result = await productsCollection.updateOne(filter, updateProduct);

            if (result.matchedCount === 0) {
                // If no result is found, treat the id as a string and try again
                filter = { _id: id };
                result = await productsCollection.updateOne(filter, updateProduct);
            }

            res.send(result);
        })

        // Review Collection 
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })


        // cart collection 
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }

            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })


        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item)
            res.send(result)
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })


        // Payment Collection 
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseFloat((price * 100).toFixed(2));
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card'],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.get('/all-payment', verifyJWT, async (req, res) => {
            const result = await paymentCollection.find().toArray()
            res.send(result)
        })

        app.get('/payment-history', verifyJWT, async (req, res) => {
            const email = req.query.email
            // if (!email) {
            //     res.send([])
            // }

            // const decodedEmail = req.decoded.email
            // if (email !== decodedEmail) {
            //     return res.status(403).send({ error: true, message: 'Forbidden access' })
            // }

            const query = { email: email }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body
            const insertResult = await paymentCollection.insertOne(payment)

            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
            const deleteResult = await cartCollection.deleteMany(query)

            res.send({ insertResult, deleteResult })
        })


        app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await usersCollection.estimatedDocumentCount();
            const products = await productsCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            // best way to get sum of field is to use group and sum operator 

            const payments = await paymentCollection.find().toArray()
            const revenue = payments.reduce((sum, payment) => sum + payment.price, 0).toFixed(2)

            res.send({
                revenue,
                users,
                products,
                orders
            })
        })

        app.get('/order-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const pipeline = [
                {
                    $lookup: {
                        from: 'products',
                        localField: 'productItems',
                        foreignField: '_id',
                        as: 'productItemsData'
                    }
                },
                {
                    $unwind: '$productItemsData'
                },
                {
                    $group: {
                        _id: '$productItemsData.category',
                        count: { $sum: 1 },
                        total: { $sum: '$productItemsData.price' }
                    }
                },
                {
                    $project: {
                        category: '$_id',
                        count: 1,
                        total: { $round: ['$total', 2] },
                        _id: 0
                    }
                }
            ];

            const result = await paymentCollection.aggregate(pipeline).toArray()
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Fashion is Running..')
})

app.listen(port, () => {
    console.log(`Sarker Fashion is Running on Port : ${port}`);
})