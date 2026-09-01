import dotenv from "dotenv";
import { listEnquiriesQuery } from "../src/modules/enquiry/repository.js";
dotenv.config();
const result = await listEnquiriesQuery({
  tenantId: 'fc75cbca-5a45-46e9-9905-521d708e5ebe',
  unitId: 'f7dab772-a5b3-404f-80bc-c5a4f5f03405',
  skip: 0,
  take: 10
});
console.log(JSON.stringify({ count: result.count, first: result.data[0] || null }, null, 2));
