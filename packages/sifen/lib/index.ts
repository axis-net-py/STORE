import { SifenClient as SC } from "../services/client";
export { SifenClient } from "../services/client";
export type { SifenConfig, SifenInvoice, SifenInvoiceItem } from "./xml-generator";
export type { SifenResponse, SifenClientConfig } from "../services/client";
export { generateRDEXML } from "./xml-generator";
export default SC;
