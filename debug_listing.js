const mongoose = require("mongoose");
const MONGODB_URI = "mongodb+srv://byv_warehouse:byvwarehouse123X2026@cluster0.rxjtdia.mongodb.net/byv?appName=Cluster0";

async function run() {
  await mongoose.connect(MONGODB_URI);
  const l = await mongoose.connection.db.collection("listings").findOne({ _id: new mongoose.Types.ObjectId("6a7444d625ac1a901652b761") });
  if (!l) {
    console.log("Listing not found!");
  } else {
    console.log("Listing:", l.title);
    console.log("Courts:", l.courts.map(c => ({ id: c.id, name: c.name, sports: c.sports })));
    console.log("All slots with overrides:");
    const overrides = l.slotsList.filter(s => s.sport || s.courtId);
    console.log(overrides);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
