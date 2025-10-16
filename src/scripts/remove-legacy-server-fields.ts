import mongoose from "mongoose";
import { ServerModel } from "../models/server.model";

export async function run2() {
  await mongoose.connect(process.env.MONGO_URI!);

  try {
    const result = await ServerModel.updateMany(
      {},
      {
        $unset: {
          "general.country": "",
          "general.country_code": "",
          "general.flag": "",
          "general.city": "",
          "general.latitude": "",
          "general.longitude": "",
        },
      }
    );

    console.log(
      `Migration complete ✅ Matched ${result.matchedCount}, modified ${result.modifiedCount} servers.`
    );

    console.log("🎉 All legacy fields removed successfully!");

    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Execute
// run2().catch((err) => {
//   console.error("Unhandled error:", err);
// });
