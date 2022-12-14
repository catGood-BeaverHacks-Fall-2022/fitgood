const port = 3005

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bcrypt = require('bcrypt');
const passport = require('passport');
const flash = require("express-flash");
const session = require('express-session');
const multer = require('multer');

var app = express();

// custom modules
var account_manager = require('./account_manager.js');
var initialize_passport = require('./passport_config.js').initialize;

initialize_passport(passport, username => account_manager.access(username));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(flash());
app.use(session({
  secret: "test secret", // in production, this would be replaced with process.env.SESSION_SECRET TO DO
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// initalizing multer for picture uploads
const fileStorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./content/" + req.user.username);
  },
  filename: (req, file, cb) => {
    file_name = Date.now() + "-" + file.originalname;
    req.upload_filename = file_name;
    cb(null, file_name);
  }
});
const upload = multer({storage: fileStorageEngine});


//create account
app.post("/api/register/", async (req, res) => {
  console.log(req.body.password)
  console.log(req.body.username)
  try{
    const hashed_password = await bcrypt.hash(req.body.password, 10)
    console.log("password:", req.body.password, "hashed password:", hashed_password)

    // attempts to create the account, responds with a 401 if it already exists
    try{
      account_manager.create(req.body.username, hashed_password);

    } catch(e){
      // account already exists
      res.send({
        successful: false
      }).status(401)

    }
    
    res.send({
      successful: true
    }).status(200)

  } catch(e) {
    // unexpected exception
    console.trace(e)
    res.send().status(500)
  } 
});

// login
app.post('/api/login/', passport.authenticate('local'), (req, res) =>{
  if(req.user){
    res.send().status(200)
  } else {
    res.send().status(401)
  }
});

// upload a clothing item, body should look like the following:
/* {
      image: {image object}
      item_name: {string} <== removed for now 
      category: {int within range of category numbers [default: 0-3]}
    }*/
app.post('/api/upload_item/', check_authenticated, upload.single("image"), (req, res) => {
  // if (!req.body.image) {
  //   res.send().status(400)
  //   console.log("req.body.image is undefined")
  //   return
  // }
  if (typeof req.body.category === 'string') {
    req.body.category = parseInt(req.body.category)
  }
  console.log("imagne:", req.body.image)
  console.log("image type:", typeof(req.body.image))

  let item_name = req.user.username + Date.now()  // this line removes necessity for filename

  account_manager.create_item(req.user, item_name, req.upload_filename, req.body.category)
  res.send().status(200)
});

app.get('/api/categories/', check_authenticated, (req, res) => {
  out = [];
  for(let i = 0; i < req.user.categories.length; i++){
    out.push(req.user.categories[i].name);
  }
  res.send({
    categories: out
  }).status(200);
});

app.get('/api/items/:category/', check_authenticated, (req, res) => {
  let cat = parseInt(req.params.category)
  items = req.user.categories[cat]
  res.send({
    clothes: items
  })
});

// image content retrival
function content_authentication(req, res, next){
  req_path = req.path.split('/');
  if(req_path.length < 3){
    res.send().status(404)
  } else {
    if(req.user.username !== req_path[1]){
      res.send().status(401);
    } else {
      return next()
    }
  }
}

// generates random outfit 
app.get('/api/outfits/random', check_authenticated, (req, res) => {
  out = [];
 
  for (let i = 0; i < req.user.categories.length; i++){
    cat_len = req.user.categories[i].items.length
    if (cat_len < 0) {
      out.push(null)
    } else {
      let index = Math.floor(Math.random() * (cat_len - 1))
      out.push(req.user.categories[i].items[index]);
    }
    
  }

  res.send({
    outfit: out
  }).status(200)
})

// app.post('/api/outfits/', check_authenticated)

app.use( check_authenticated, content_authentication, express.static(__dirname + "/content"))



// for testing only TODO - remove
app.get('/api/user/', check_authenticated, (req, res) => {
  res.send().status(200)
});



// ping
app.get('/', function(req, res, next){
  res.send().status(200)
});

// checks if request is authenticated by passport
function check_authenticated(req, res, next){
  if(req.isAuthenticated()){
    return next()
  } 

  console.log("unauthenticated request")
  res.send().status(401)
}

// TODO: remove
// function checkNotAuthenticated(req, res, next){

// }


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
});

module.exports = app;
