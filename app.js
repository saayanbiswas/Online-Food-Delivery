var express = require("express");
var app = express();
var mongoose = require("mongoose");
var Product = require("./models/product");
var User = require("./models/user");
var bodyParser=			require("body-parser");
var session = require("express-session");
var passport=           require("passport");
var LocalStrategy=      require("passport-local");
var passportLocatMongoose=require("passport-local-mongoose");
var mongoStore = require("connect-mongo")(session);
var Cart = require("./models/cart");
var Order = require("./models/order");


app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + '/public'));

mongoose.connect("mongodb+srv://SaayanBiswas:saayanbiswas@cluster0.hvhmf.mongodb.net/<dbname>?retryWrites=true&w=majority",{ useUnifiedTopology: true, useNewUrlParser: true }).catch(error => handleError(error));;


//====PASSPORT======

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

app.use(session({
    secret:"This is our shopping cart",
    resave:false,
    saveUninitialized:false,
    store:new mongoStore({
        mongooseConnection:mongoose.connection,
        cookie:{maxAge: 180*60*1000}
    })
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
//====Current loggedin user=======
app.use(function(req,res,next){
    res.locals.currentUser = req.user;
    res.locals.session = req.session;
    next();
});


app.get("/",function(req,res){
    res.render("main");
});


app.get("/index",function(req,res){
    Product.find({},function(err,foundProduct){
        if(err)
        {
            console.log(err);
        }
        else
        {
            res.render("index",{product:foundProduct});
        }
    });
});

app.get("/user/signup",notLoggedIn,function(req,res,){
    res.render("user/signup");
});

app.post("/user/signup",notLoggedIn,function(req,res){
    var newUser = new User({
        username:req.body.username,
        email:req.body.email,
        address:{
            address:req.body.country,
            state:req.body.state,
            city:req.body.city,
            pin:req.body.pin,
            landmark:req.body.landmark,
            apparmentName:req.body.apparmentName,
            flatNo:req.body.flatNo
        },
        mobileNumber:req.body.mobileNumber
    });
    User.register(newUser,req.body.password,function(err,user){
        if(err)
        {
            console.log(err);
            return res.render("user/signUp");
        }
        passport.authenticate("local")(req,res,function(){
            res.redirect("/");
        });
    });
});
//LOGIN
app.get("/user/login",notLoggedIn,function(req,res){
    res.render("user/login");
});
app.post("/user/login",notLoggedIn,passport.authenticate("local",
{
    successRedirect:"/",
    failureRedirect:"/user/login"
}),function(req,res){

});
//Log Out
app.get("/user/logout",function(req,res){
    req.logOut();
    res.redirect("/");
});

app.get("/profile",isLoggedIn,function(req,res){
    Order.find({user:req.user}).populate("user").exec(function(err,orders){
        if(err)
        {
            console.log(err);
        }
        var cart;
        orders.forEach(function(order){
            cart = new Cart(order.cart);
            order.items = cart.generateArray();
        });
        res.render("user/profile",{orders:orders});
    });
});

app.get("/add-to-cart/:id",function(req,res){
    var productid = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    Product.findById(productid,function(err,product){
        if(err)
        {
            console.log(err)
            return res.redirect("/");
        }
        cart.add(product, productid);
        req.session.cart = cart;
        res.redirect("/index");
    });
});

app.get("/reduce/:id",function(req,res){
    var productid = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});
    cart.reduceByOne(productid);
    req.session.cart = cart;
    res.redirect("/shopping-cart");
});

app.get("/removeAll/:id",function(req,res){
    var productid = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});
    cart.removeAll(productid);
    req.session.cart = cart;
    res.redirect("/shopping-cart");
});


app.get("/shopping-cart",function(req,res){
    if(!req.session.cart)
    {
        return res.render("shoppingcart",{product:null});
    }
    var cart = new Cart(req.session.cart);
    res.render("shoppingCart",{product:cart.generateArray(),totalPrice:cart.totalPrice})
});


app.get("/checkout",isLoggedIn,function(req,res,next){
    if(!req.session.cart)
    {
        return res.redirect("/");
    }
    var cart = new Cart(req.session.cart);
    res.render("checkout",{total:cart.totalPrice})
});


app.post("/checkout",isLoggedIn,function(req,res,next){
    if(!req.session.cart)
    {
        return res.redirect("/");
    }
    var cart = new Cart(req.session.cart);
    var order = new Order({
        user:req.user,
        cart:cart,
    });
    order.save();
    req.session.cart = null;
    res.redirect("/");
});
 
app.get("/owner",isLoggedInAndIsOwner,function(req,res){
    res.render("owner");
});
app.get("/owner/addProduct",function(req,res){
    res.render("addProduct");
});
app.post("/owner/addProduct",function(req,res){
    Product.create(req.body.product,function(err,createrProduct){
        if(err)
        {
            console.log(err);
        }
        else
        {
            res.redirect("/owner");
        }
    })
});
app.get("/owner/allOrders",function(req,res){
    Order.find({}).populate("user").exec(function(err,orders){
        if(err)
        {
            console.log(err);
        }
        var cart;
        orders.forEach(function(order){
            cart = new Cart(order.cart);
            order.items = cart.generateArray();
        });
        res.render("allOrders",{orders:orders});
    });
});




function isLoggedIn(req,res,next){
    if(req.isAuthenticated())
    {
        return next();
    }
    res.redirect("/user/login");
}
function notLoggedIn(req,res,next){
    if(!req.isAuthenticated())
    {
        return next();
    }
    res.redirect("/");
}
function isLoggedInAndIsOwner(req,res,next){
    if((req.isAuthenticated()) &&(req.user.username == "mrinalseth") )
    {
        return next();
    }
    res.redirect("/user/login");
}








app.listen(process.env.PORT||3000,process.env.IP,function(){
    console.log("SERVER STARTED");
});
