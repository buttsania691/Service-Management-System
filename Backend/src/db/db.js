const mongoose=require("mongoose");
async function Connectdb(){
    try{
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connect Db");
    }
    catch (err){
        console.error("Database Error",err);
    }
   
}
module.exports=Connectdb;
