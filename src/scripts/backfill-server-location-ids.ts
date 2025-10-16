import mongoose from "mongoose";
import { ServerModel } from "../models/server.model";
import { CityModel } from "../models/city.model";
import { CountryModel } from "../models/country.model";

export async function run() {
  await mongoose.connect(process.env.MONGO_URI!);

  try {
    const cursor = ServerModel.find({
      $or: [
        { "general.country_id": { $exists: false } },
        { "general.city_id": { $exists: false } },
      ],
    }).cursor();

    let updated = 0;

    for (
      let doc = await cursor.next();
      doc != null;
      doc = await cursor.next()
    ) {
      const legacyCountryCode = doc.general.country_code?.toUpperCase();
      const legacyCityName = doc.general.city?.trim();

      if (!legacyCountryCode || !legacyCityName) {
        console.warn(
          `Skipping server ${doc._id} — missing legacy country/city`
        );
        continue;
      }

      const country = await CountryModel.findById(legacyCountryCode);
      if (!country) {
        console.warn(
          `Country not found: ${legacyCountryCode} for server ${doc._id}`
        );
        continue;
      }

      // Try to find city by name
      let city = await CityModel.findOne({
        country: country._id,
        name: legacyCityName,
      });

      if (!city) {
        // fallback to slug
        const slug = legacyCityName
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .replace(/\s+/g, "-");

        city = await CityModel.findOne({ country: country._id, slug });
      }

      if (!city) {
        console.warn(
          `City not found: ${legacyCityName} (${country._id}) for server ${doc._id}`
        );
        continue;
      }

      // Only update the IDs — do not touch any other fields
      let modified = false;
      if (!doc.general.country_id) {
        doc.general.country_id = country._id;
        modified = true;
      }
      if (!doc.general.city_id) {
        doc.general.city_id = city._id;
        modified = true;
      }

      if (modified) {
        await doc.save({ validateBeforeSave: true });
        updated++;
        console.log(`Updated server ${doc._id} — country_id and city_id set`);
      }
    }

    await mongoose.disconnect();
    console.log(`Backfill complete. Updated ${updated} servers.`);
  } catch (err) {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// run().catch(console.error);
