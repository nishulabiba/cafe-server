const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
//
//stripe key
const stripe = require('stripe')(process.env.SECRET_KEY)

//middlewares

app.use(cors());
app.use(express.json())
// middlewares 
const verifyJwt = (req, res, next) => {
  console.log(req.headers);
  const authorization = req.headers.authorization || req.headers.Authorization;
  console.log('Authorization Header:', authorization);

  if (!authorization) {
    console.log('No Authorization Header');
    return res.status(401).send({ message: 'unauthorized access' });
  }

  const token = authorization.split(' ')[1];
  console.log('Token:', token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.error('JWT Verification Error:', err);
      return res.status(401).send({ message: 'unauthorized access' });
    } else {
      req.decoded = decoded;
      next();
    }
  });
};


//mongodb connect

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.ubbebrm.mongodb.net/?retryWrites=true&w=majority`;

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
    //database collection

    const usersCollection = client.db("cafedb").collection("users")
    const menuCollection = client.db("cafedb").collection("menu");
    const reviewsCollection = client.db("cafedb").collection("reviews");
    const cartCollection = client.db("cafedb").collection("carts");
    const paymentCollection = client.db("cafedb").collection("payments");
    const reservationCollection = client.db("cafedb").collection("reservations");
    

    //JWT GENERATION...
    app.post("/jwt", (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.query.email;
      console.log(email);
      //security level: check logged user.
      if (!email) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      //security level : check admin role
      const admin = { admin: user?.role === 'admin' }
      console.log(admin.admin);
      if (admin.admin == false) {
        return res.status(401).send({ message: 'forbidden  access' });
      }
      next()
    }
    //user related api....................


    app.post("/users", async (req, res) => {

      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        res.send({ message: "User already exists!!!" })
      }
      else {
        const result = await usersCollection.insertOne(user)
        res.send(result)
      }
    })

    app.get("/users",verifyJwt, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      // const email = req.query.email;
      // //security level: check logged user.
      // if (!email) {
      //   return res.status(401).send({ message: 'unauthorized access' });
      // }
      // const query = { email: email }
      // const user = await usersCollection.findOne(query)
      // //security level : check admin role
      // const admin = {admin: user?.role === 'admin' }
      // console.log(admin.admin);
      // if(admin.admin == false){
      //   return res.status(401).send({ message: 'forbidden  access' });

      // }
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    //patch the user's role

    app.patch("/users/admin/:id", verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: `admin`
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    }

    )
    //get user's role

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      // //security 1st layer : check jwt token
      // console.log(req.decoded.email);
      if (!email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      //security level 2: check email

      const query = { email: email }
      const user = await usersCollection.findOne(query)
      //security level 3: check admin role
      const result = { admin: user?.role === 'admin' }
      res.send(result.admin);
    })
    //delete admin role
    app.patch("/delete/admin/:id",verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: `user`
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    }

    )

    // Food related api.......................
    app.post("/menu", async (req, res) => {
      const newItem = req.body;
      const email = req.query.email;
      //security level: check logged user.
      if (!email) {
        return res.status(401).send({ message: "You're  not allowed to post" });
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      //security level : check admin role
      const admin = { admin: user?.role === 'admin' }
      if (admin.admin == false) {
        return res.status(401).send({ message: 'forbidden  access' });

      }
      const result = await menuCollection.insertOne(newItem)
      res.send(result)
    })
    app.delete("/delete/item/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }

        const result = await menuCollection.deleteOne(filter)
        res.send(result)
      } catch (err) {
        res.send(err.message)
      }
    })
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result)
    })
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;


      try {
        const result = await menuCollection.find().toArray()
        const filter =  result.filter(item=> item._id === id)
        if (result) {
          res.send(filter[0]);
        } else {
          // If no document is found, send a 404 Not Found status
          res.status(404).send("Menu not found");
        }
      } catch (error) {
        // Handle other potential errors (e.g., database connection issues)
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    //get single menu item....

    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })
    // cart posted

    app.post("/carts", async (req, res) => {

      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result)
    })
    // reservations collection
    app.post("/reservations", verifyJwt, async (req, res) => {

      const item = req.body;
      const result = await reservationCollection.insertOne(item);
      res.send(result)
    })

    app.get('/reservations', verifyJwt, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const query = { email: email };
      const result = await reservationCollection.find(query).toArray();
      res.send(result);
    })
    app.delete("/delete/booking/:id", async (req, res) => {
      try {
       
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }

        const result = await reservationCollection.deleteOne(filter)
        res.send(result)
      } catch (err) {
        res.send(err.message)
      }
    })  

    // carts collection
    app.get('/carts', async (req, res) => {

      const email = req.query.email;
      if (!email) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.delete('/carts/:email', async (req, res) => {
      try {
        const email = req.params.email;
        

        const result = await cartCollection.deleteMany({email: email})
        res.send(result)
      } catch (err) {
        res.send(err.message)
      }
    })

    app.delete("/delete/:id", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }

        const result = await cartCollection.deleteOne(filter)
        res.send(result)
      } catch (err) {
        res.send(err.message)
      }
    })

    //payment method
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;
        const amount = parseInt(parseFloat(price) * 100);



        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        })
          .then(async (paymentIntent) => {
            const secret = await paymentIntent.client_secret

            res.send({
              clientSecret: secret
            });
          })
          .catch(error => {
            console.error(error);
          });
      }
      catch (error) {
        console.log(error);
      }
    }
    )

    app.post('/payments', async(req, res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {_id: {$in: payment.items.map(id=> new ObjectId(id))} }
      const deleteResult = await cartCollection.deleteMany(query)
      res.send({paymentResult, deleteResult})
    })
    app.get("/payments", verifyJwt, async(req, res)=>{
      const result = await paymentCollection.find().toArray();
      res.send(result)
    })

    ///order statistics
    app.get("/order-stats", async(req, res)=>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'items',
            foreignField: '_id',
            as: 'menuItemData'
          }
        },
        {
          $unwind: '$menuItemData' // Unwind the menuItemData array
        },
        {
          $group: {
            _id: '$menuItemData.category',
            quantity: { $sum: 1 }, // Sum up the quantity field
            total: { $sum: '$menuItemData.price' } // Calculate total price for each category
          }
        },
        
  {
    $project: {
      category: "$_id", // Rename _id to category
      total: { $round: ["$total", 2] }, // Round total to 2 decimal places
      quantity: 1, // Include totalQuantity
      _id: 0 // Exclude _id field
    }
  }
      ];
      const result = await paymentCollection.aggregate(pipeline).toArray();

      console.log(result);
      res.json(result);
    })

    app.get("/admin-stats", async(req, res)=>{
      const email = req.query.email;
      const customers = await usersCollection.estimatedDocumentCount()
      const products = await menuCollection.estimatedDocumentCount()
      const orders = await paymentCollection.estimatedDocumentCount()
      // revenue
      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment)=> sum+payment.price, 0)
      res.send({revenue, customers, orders, products})
    })
    


    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Server is implemented successfully!!!!!!!")
})








app.listen(port, () => {
  console.log(`the server is running on port: ${port}`);
})