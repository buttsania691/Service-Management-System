const mongoose=require("mongoose");
const serviceSchema= new mongoose.Schema({
   Name:String,
   Icons:String,
   Price:String,
   Description: String,
   importantNote: String,
    pricingType: { type: String, enum: ["hourly", "quantity"], default: "hourly" }
})
const serviceModel=mongoose.model("service",serviceSchema);
module.exports=serviceModel;