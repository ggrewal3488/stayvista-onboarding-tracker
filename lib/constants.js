export const PROPERTY_TYPES = ["Residences", "Resort", "Villa"];
export const AGREEMENT_TYPES = ["Lease", "All In", "Revenue Share"];
export const AGREEMENT_STATUSES = ["Signed", "Not Signed"];
export const ACQUISITION_AGENTS = [
  "Neha Singh", "Saurav Sharma", "Aastha Johari", "Shruti Gupta",
  "Jaynandan Kumar", "Mukesh Kumar Shandil", "Priyanshi Pal",
];
export const OPS_OWNERS = ["Manoj Dhiman", "Aakib Hashmi", "Gursimran Grewal", "Others"];
export const YES_NO_NA = ["Yes", "No", "NA"];
export const STAFFING_STATUSES = ["Staffing Adequate", "Need to Hire", "NA"];
export const STAFF_INV_AGENTS = ["Manoj Dhiman", "Arpit Awasthi", "Gursimran Grewal", "Others"];
export const INVENTORY_STATUSES = ["Inventory Adequate", "Need to Procure", "NA"];
export const TECH_STATUSES = [
  "Tech Audit - Passed", "Tech Audit - Failed", "Tech Audit - Needs Attension", "NA",
];
export const TECH_AGENTS = ["Dinesh", "Virender Thakur", "Others"];
export const ACCOUNT_MANAGERS = [
  "Garima Jha", "Vishal Mishra", "Divya Sharma", "Khushbu Mehta", "Hitesh Dangwal",
  "Sujit Devnath", "Bhumika Tikhatri", "Rohit Lohani", "Manpreet Bedi", "Haider Talib",
  "Himanshu Sharma", "Ankit Bhatt", "Barkha", "Ruchita Jain",
];
export const OPS_SIM_STATUSES = ["Completed - Passed", "Completed - Failed", "Pending", "NA"];

export function overallStatus(p) {
  let bad = 0;
  if (p.staffingAuditStatus === "Need to Hire") bad++;
  if (p.inventoryReportStatus === "Need to Procure") bad++;
  if (p.technicalAuditStatus === "Tech Audit - Failed" || p.technicalAuditStatus === "Tech Audit - Needs Attension") bad++;
  if (bad === 0) return "On-Track";
  if (bad <= 2) return "At-Risk";
  return "Blocked";
}

export function preOnboardingComplete(p) {
  const notes = (p.agmNotes || []).map((n) => (n && n.text) || "").join(" ").toLowerCase();
  return notes.indexOf("ready to go live") !== -1 ? "Complete" : "Pending";
}

export const EXPORT_COLUMNS = [
  ["propertyName", "Property Name"], ["propertyType", "Property Type"], ["bedrooms", "Bedrooms"],
  ["location", "Location"], ["acquisitionAgent", "Acquisition Agent"], ["acquisitionDate", "Acquisition Date"],
  ["agreementType", "Agreement Type"], ["agreementStatus", "Agreement Status"],
  ["opsPreHandoverDate", "Ops Pre-Handover Date"], ["opsPreHandoverOwner", "Ops Pre-Handover Owner"],
  ["teamDeploy", "Pre-Onboarding Team to be Deployed"], ["teamDeployOps", "Team Deploy - Ops"],
  ["teamDeployTech", "Team Deploy - Tech"], ["teamDeployEventsFnb", "Team Deploy - Events & F&B"],
  ["teamDeployReason", "Team Deploy - Reason"], ["staffingAuditStatus", "Staffing Audit Status"],
  ["staffingAuditAgent", "Staffing Audit Agent"], ["staffingAuditDetails", "Staffing Audit Details"],
  ["inventoryReportStatus", "Inventory Report Status"], ["inventoryReportAgent", "Inventory Report Agent"],
  ["inventoryReportDetails", "Inventory Report Details"], ["technicalAuditStatus", "Technical Audit Status"],
  ["technicalAuditAgent", "Technical Audit Agent"], ["technicalAuditDetails", "Technical Audit Details"],
  ["accountManager", "Account Manager"], ["assignedPM", "Assigned PM"],
  ["targetGoLiveDate", "Target Go-Live Date"], ["goLiveStartDate", "Go-Live Start Date"],
  ["opsSimAuditStatus", "Ops Simulation Audit Status"], ["opsSimAuditDoneBy", "Ops Simulation Done By"],
  ["opsSimDetails", "Ops Simulation Details"], ["postLaunchTrackersCreated", "Post-Launch Trackers Created"],
  ["postLaunchTrackersLink", "Post-Launch Trackers Link"],
];
