
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.TenantScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  plan: 'plan',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UnitScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  logoUrl: 'logoUrl',
  shortName: 'shortName',
  unitType: 'unitType',
  locationId: 'locationId',
  address: 'address',
  pincode: 'pincode',
  email: 'email',
  phone: 'phone',
  status: 'status',
  tenantId: 'tenantId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  tenantId: 'tenantId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  module: 'module',
  action: 'action',
  description: 'description',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RolePermissionScalarFieldEnum = {
  id: 'id',
  roleId: 'roleId',
  permissionId: 'permissionId',
  tenantId: 'tenantId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  firstName: 'firstName',
  lastName: 'lastName',
  mobile: 'mobile',
  roleId: 'roleId',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffScalarFieldEnum = {
  id: 'id',
  empId: 'empId',
  firstName: 'firstName',
  lastName: 'lastName',
  designation: 'designation',
  department: 'department',
  phone: 'phone',
  email: 'email',
  joiningDate: 'joiningDate',
  status: 'status',
  photoUrl: 'photoUrl',
  userId: 'userId',
  metadata: 'metadata',
  skills: 'skills',
  location: 'location',
  isAvailable: 'isAvailable',
  performanceScore: 'performanceScore',
  workload: 'workload',
  currentWorkload: 'currentWorkload',
  latitude: 'latitude',
  longitude: 'longitude',
  shiftStart: 'shiftStart',
  shiftEnd: 'shiftEnd',
  capacity: 'capacity',
  stressLevel: 'stressLevel',
  lastActiveAt: 'lastActiveAt',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CityScalarFieldEnum = {
  id: 'id',
  name: 'name',
  state: 'state',
  country: 'country',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LocationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  createdAt: 'createdAt'
};

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  refNo: 'refNo',
  name: 'name',
  mobile: 'mobile',
  email: 'email',
  address: 'address',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JobApplicationScalarFieldEnum = {
  id: 'id',
  applicationNo: 'applicationNo',
  companyUnit: 'companyUnit',
  applyFor: 'applyFor',
  experience: 'experience',
  location: 'location',
  applicantName: 'applicantName',
  mobileNo: 'mobileNo',
  email: 'email',
  resumeUrl: 'resumeUrl',
  followupStatus: 'followupStatus',
  interestStatus: 'interestStatus',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EnquiryScalarFieldEnum = {
  id: 'id',
  refNo: 'refNo',
  clientId: 'clientId',
  serviceId: 'serviceId',
  mode: 'mode',
  source: 'source',
  channelId: 'channelId',
  rawMessage: 'rawMessage',
  description: 'description',
  status: 'status',
  priority: 'priority',
  intent: 'intent',
  sentiment: 'sentiment',
  summary: 'summary',
  urgency: 'urgency',
  isConverted: 'isConverted',
  convertedAt: 'convertedAt',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AdmissionScalarFieldEnum = {
  id: 'id',
  enquiryId: 'enquiryId',
  patientId: 'patientId',
  tenantId: 'tenantId',
  unitId: 'unitId',
  status: 'status',
  admittedAt: 'admittedAt',
  dischargedAt: 'dischargedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FollowUpScalarFieldEnum = {
  id: 'id',
  enquiryId: 'enquiryId',
  notes: 'notes',
  scheduledAt: 'scheduledAt',
  actualAt: 'actualAt',
  channel: 'channel',
  response: 'response',
  converted: 'converted',
  responseAt: 'responseAt',
  outcome: 'outcome',
  variant: 'variant',
  successScore: 'successScore',
  clientInterest: 'clientInterest',
  readyToPayAmount: 'readyToPayAmount',
  paymentMode: 'paymentMode',
  nextFollowupStatus: 'nextFollowupStatus',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AllocationScalarFieldEnum = {
  id: 'id',
  refNo: 'refNo',
  enquiryId: 'enquiryId',
  type: 'type',
  staffId: 'staffId',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  metadata: 'metadata',
  allocationScore: 'allocationScore',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountTransactionScalarFieldEnum = {
  id: 'id',
  refNo: 'refNo',
  allocationId: 'allocationId',
  type: 'type',
  amount: 'amount',
  paymentMode: 'paymentMode',
  category: 'category',
  clientName: 'clientName',
  status: 'status',
  notes: 'notes',
  date: 'date',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  refNo: 'refNo',
  title: 'title',
  description: 'description',
  priority: 'priority',
  aiSummary: 'aiSummary',
  aiUrgency: 'aiUrgency',
  enquiryId: 'enquiryId',
  assigneeId: 'assigneeId',
  assignedStaffId: 'assignedStaffId',
  approvalAuthorityId: 'approvalAuthorityId',
  type: 'type',
  dueDate: 'dueDate',
  status: 'status',
  completedAt: 'completedAt',
  feedbackScore: 'feedbackScore',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ComplaintScalarFieldEnum = {
  id: 'id',
  refNo: 'refNo',
  title: 'title',
  type: 'type',
  description: 'description',
  status: 'status',
  priority: 'priority',
  sentiment: 'sentiment',
  urgency: 'urgency',
  serviceTag: 'serviceTag',
  channel: 'channel',
  channelId: 'channelId',
  metadata: 'metadata',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkflowLogScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  fromState: 'fromState',
  toState: 'toState',
  actionBy: 'actionBy',
  notes: 'notes',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApprovalScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  approverId: 'approverId',
  status: 'status',
  comments: 'comments',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  module: 'module',
  action: 'action',
  payload: 'payload',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FileStorageScalarFieldEnum = {
  id: 'id',
  fileName: 'fileName',
  fileUrl: 'fileUrl',
  fileType: 'fileType',
  fileSize: 'fileSize',
  entityType: 'entityType',
  entityId: 'entityId',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RefCounterScalarFieldEnum = {
  id: 'id',
  prefix: 'prefix',
  current: 'current',
  tenantId: 'tenantId',
  unitId: 'unitId'
};

exports.Prisma.BlogScalarFieldEnum = {
  id: 'id',
  unitName: 'unitName',
  title: 'title',
  date: 'date',
  keywords: 'keywords',
  description: 'description',
  images: 'images',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClientServiceScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  category: 'category',
  price: 'price',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DepartmentScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  head: 'head',
  totalStaff: 'totalStaff',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LabourServiceScalarFieldEnum = {
  id: 'id',
  code: 'code',
  type: 'type',
  rate: 'rate',
  agency: 'agency',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentCategoryScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  type: 'type',
  description: 'description',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VendorScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  category: 'category',
  contact: 'contact',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoomScalarFieldEnum = {
  id: 'id',
  code: 'code',
  type: 'type',
  capacity: 'capacity',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VitalSignScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  bp: 'bp',
  pulse: 'pulse',
  temp: 'temp',
  spO2: 'spO2',
  notes: 'notes',
  recordedById: 'recordedById',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WelcomeCallScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  status: 'status',
  notes: 'notes',
  callDate: 'callDate',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FeedbackScalarFieldEnum = {
  id: 'id',
  allocationId: 'allocationId',
  rating: 'rating',
  comments: 'comments',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomationRuleScalarFieldEnum = {
  id: 'id',
  module: 'module',
  name: 'name',
  conditions: 'conditions',
  action: 'action',
  actionValue: 'actionValue',
  priority: 'priority',
  status: 'status',
  baseWeight: 'baseWeight',
  performanceWeight: 'performanceWeight',
  conversionRate: 'conversionRate',
  triggerCount: 'triggerCount',
  conversionCount: 'conversionCount',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomationWorkflowScalarFieldEnum = {
  id: 'id',
  module: 'module',
  triggerEvent: 'triggerEvent',
  conditions: 'conditions',
  actionType: 'actionType',
  actionConfig: 'actionConfig',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomationScoreScalarFieldEnum = {
  id: 'id',
  entityId: 'entityId',
  module: 'module',
  score: 'score',
  label: 'label',
  probability: 'probability',
  confidence: 'confidence',
  historyScore: 'historyScore',
  factors: 'factors',
  tenantId: 'tenantId',
  unitId: 'unitId',
  complaintId: 'complaintId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomationTaskScalarFieldEnum = {
  id: 'id',
  entityId: 'entityId',
  module: 'module',
  taskType: 'taskType',
  description: 'description',
  assignedTo: 'assignedTo',
  status: 'status',
  priority: 'priority',
  attempts: 'attempts',
  maxAttempts: 'maxAttempts',
  dependsOnTaskId: 'dependsOnTaskId',
  metadata: 'metadata',
  scheduledAt: 'scheduledAt',
  completedAt: 'completedAt',
  lastError: 'lastError',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomationLogScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  unitId: 'unitId',
  module: 'module',
  entityId: 'entityId',
  event: 'event',
  score: 'score',
  label: 'label',
  triggeredRules: 'triggeredRules',
  payload: 'payload',
  traceData: 'traceData',
  actionResults: 'actionResults',
  feedbackSummary: 'feedbackSummary',
  conversationId: 'conversationId',
  createdAt: 'createdAt'
};

exports.Prisma.AutomationSuggestionScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  unitId: 'unitId',
  module: 'module',
  conditions: 'conditions',
  suggestedScore: 'suggestedScore',
  confidence: 'confidence',
  status: 'status',
  reasoning: 'reasoning',
  createdAt: 'createdAt'
};

exports.Prisma.CommunicationLogScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  conversationId: 'conversationId',
  channel: 'channel',
  channelId: 'channelId',
  direction: 'direction',
  message: 'message',
  status: 'status',
  templateName: 'templateName',
  externalMessageId: 'externalMessageId',
  metadata: 'metadata',
  rawPayload: 'rawPayload',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt'
};

exports.Prisma.ConversationScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  clientId: 'clientId',
  enquiryId: 'enquiryId',
  channel: 'channel',
  subject: 'subject',
  externalThreadId: 'externalThreadId',
  lastMessageAt: 'lastMessageAt',
  status: 'status',
  metadata: 'metadata',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  direction: 'direction',
  channel: 'channel',
  sender: 'sender',
  recipient: 'recipient',
  body: 'body',
  status: 'status',
  templateName: 'templateName',
  variant: 'variant',
  externalMessageId: 'externalMessageId',
  metadata: 'metadata',
  sentAt: 'sentAt',
  deliveredAt: 'deliveredAt',
  readAt: 'readAt',
  createdAt: 'createdAt',
  tenantId: 'tenantId',
  unitId: 'unitId'
};

exports.Prisma.RevenueForecastScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  unitId: 'unitId',
  forecastDate: 'forecastDate',
  periodStart: 'periodStart',
  periodEnd: 'periodEnd',
  scope: 'scope',
  expectedRevenue: 'expectedRevenue',
  projectedRevenue: 'projectedRevenue',
  baselineRevenue: 'baselineRevenue',
  pipelineRevenue: 'pipelineRevenue',
  growthRate: 'growthRate',
  confidence: 'confidence',
  contributingData: 'contributingData',
  reasoning: 'reasoning',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AutomationFeedbackScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  unitId: 'unitId',
  module: 'module',
  entityId: 'entityId',
  event: 'event',
  responseRate: 'responseRate',
  conversionRate: 'conversionRate',
  completionRate: 'completionRate',
  optimizationScore: 'optimizationScore',
  signals: 'signals',
  appliedChanges: 'appliedChanges',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AgentRunScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  unitId: 'unitId',
  module: 'module',
  entityId: 'entityId',
  agentType: 'agentType',
  priority: 'priority',
  status: 'status',
  dependsOnRunId: 'dependsOnRunId',
  attempt: 'attempt',
  maxAttempts: 'maxAttempts',
  input: 'input',
  output: 'output',
  error: 'error',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MessageTemplateScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  unitId: 'unitId',
  channel: 'channel',
  name: 'name',
  subject: 'subject',
  content: 'content',
  variant: 'variant',
  status: 'status',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OutboundCampaignScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  unitId: 'unitId',
  name: 'name',
  channel: 'channel',
  templateName: 'templateName',
  status: 'status',
  audienceType: 'audienceType',
  filters: 'filters',
  sentCount: 'sentCount',
  deliveredCount: 'deliveredCount',
  failedCount: 'failedCount',
  scheduledAt: 'scheduledAt',
  launchedAt: 'launchedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientScalarFieldEnum = {
  id: 'id',
  name: 'name',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientPortalAccountScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  mobile: 'mobile',
  password: 'password',
  name: 'name',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientPortalSessionScalarFieldEnum = {
  id: 'id',
  accountId: 'accountId',
  token: 'token',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.MedicationScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  name: 'name',
  dosage: 'dosage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NutritionScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  calories: 'calories',
  dietPlan: 'dietPlan',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MaintenanceScalarFieldEnum = {
  id: 'id',
  type: 'type',
  status: 'status',
  unitId: 'unitId',
  tenantId: 'tenantId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LaundryScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  status: 'status',
  unitId: 'unitId',
  tenantId: 'tenantId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  name: 'name',
  category: 'category',
  unitId: 'unitId',
  tenantId: 'tenantId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  quantity: 'quantity',
  unitId: 'unitId',
  tenantId: 'tenantId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PurchaseScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  quantity: 'quantity',
  vendor: 'vendor',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  status: 'status',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  category: 'category',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DonorScalarFieldEnum = {
  id: 'id',
  donorNo: 'donorNo',
  name: 'name',
  residentialAddress: 'residentialAddress',
  permanentAddress: 'permanentAddress',
  mobile: 'mobile',
  whatsappNumber: 'whatsappNumber',
  email: 'email',
  panNumber: 'panNumber',
  fatherOrHusbandName: 'fatherOrHusbandName',
  dob: 'dob',
  isCorporate: 'isCorporate',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdBy: 'createdBy',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DonationScalarFieldEnum = {
  id: 'id',
  receiptNo: 'receiptNo',
  donorId: 'donorId',
  date: 'date',
  amount: 'amount',
  amountInWords: 'amountInWords',
  paymentMode: 'paymentMode',
  materialDetails: 'materialDetails',
  category: 'category',
  purpose: 'purpose',
  occasionName: 'occasionName',
  occasionRelation: 'occasionRelation',
  occasionDate: 'occasionDate',
  occasionMobile: 'occasionMobile',
  recurringPlan: 'recurringPlan',
  preferredPrayerDate: 'preferredPrayerDate',
  honouredPersonImage: 'honouredPersonImage',
  specialPrayerMessage: 'specialPrayerMessage',
  wishToVisitHome: 'wishToVisitHome',
  preferredVisitDate: 'preferredVisitDate',
  taxDeduction: 'taxDeduction',
  receivedBy: 'receivedBy',
  verifiedBy: 'verifiedBy',
  isReceiptSent: 'isReceiptSent',
  receiptSentAt: 'receiptSentAt',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdBy: 'createdBy',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DonationReferenceScalarFieldEnum = {
  id: 'id',
  donationId: 'donationId',
  name: 'name',
  mobile: 'mobile',
  tenantId: 'tenantId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VisitorProfileScalarFieldEnum = {
  id: 'id',
  mobile: 'mobile',
  name: 'name',
  category: 'category',
  company: 'company',
  photoUrl: 'photoUrl',
  email: 'email',
  tenantId: 'tenantId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VisitorPassScalarFieldEnum = {
  id: 'id',
  visitorId: 'visitorId',
  passType: 'passType',
  purpose: 'purpose',
  department: 'department',
  hostName: 'hostName',
  hostMobile: 'hostMobile',
  vehicleNo: 'vehicleNo',
  materialDetails: 'materialDetails',
  checkInAt: 'checkInAt',
  checkOutAt: 'checkOutAt',
  expectedAt: 'expectedAt',
  status: 'status',
  qrCodeUrl: 'qrCodeUrl',
  tenantId: 'tenantId',
  unitId: 'unitId',
  recordedBy: 'recordedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ResidentTimelineScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  category: 'category',
  action: 'action',
  details: 'details',
  performedBy: 'performedBy',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ADLRecordScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  mobility: 'mobility',
  hygiene: 'hygiene',
  feeding: 'feeding',
  notes: 'notes',
  status: 'status',
  recordedById: 'recordedById',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.IncidentScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  title: 'title',
  description: 'description',
  date: 'date',
  severity: 'severity',
  witnesses: 'witnesses',
  actionTaken: 'actionTaken',
  tenantId: 'tenantId',
  unitId: 'unitId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockIssueRequestScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  productName: 'productName',
  category: 'category',
  quantity: 'quantity',
  usageType: 'usageType',
  issuedTo: 'issuedTo',
  notes: 'notes',
  status: 'status',
  requestedBy: 'requestedBy',
  requestedAt: 'requestedAt',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  rejectedBy: 'rejectedBy',
  rejectedAt: 'rejectedAt',
  tenantId: 'tenantId',
  unitId: 'unitId',
  isDeleted: 'isDeleted',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  allocationId: 'allocationId',
  patientId: 'patientId',
  rate: 'rate',
  amount: 'amount'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.EnquiryStatus = exports.$Enums.EnquiryStatus = {
  NEW: 'NEW',
  FOLLOW_UP: 'FOLLOW_UP',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED'
};

exports.AllocationType = exports.$Enums.AllocationType = {
  HOME_CARE: 'HOME_CARE',
  CLINICAL: 'CLINICAL',
  IN_HOUSE: 'IN_HOUSE',
  OTHERS: 'OTHERS'
};

exports.AllocationStatus = exports.$Enums.AllocationStatus = {
  PENDING: 'PENDING',
  ALLOCATED: 'ALLOCATED',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED'
};

exports.TransactionType = exports.$Enums.TransactionType = {
  INVOICE: 'INVOICE',
  RECEIPT: 'RECEIPT',
  EXPENSE: 'EXPENSE',
  REFUND: 'REFUND'
};

exports.TransactionStatus = exports.$Enums.TransactionStatus = {
  CREATED: 'CREATED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  REJECTED: 'REJECTED'
};

exports.TaskStatus = exports.$Enums.TaskStatus = {
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  APPROVED: 'APPROVED'
};

exports.ComplaintStatus = exports.$Enums.ComplaintStatus = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

exports.ApprovalStatus = exports.$Enums.ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

exports.ConversationStatus = exports.$Enums.ConversationStatus = {
  OPEN: 'OPEN',
  WAITING: 'WAITING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

exports.MessageDirection = exports.$Enums.MessageDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
  SYSTEM: 'SYSTEM'
};

exports.Prisma.ModelName = {
  Tenant: 'Tenant',
  Unit: 'Unit',
  Role: 'Role',
  Permission: 'Permission',
  RolePermission: 'RolePermission',
  User: 'User',
  Staff: 'Staff',
  City: 'City',
  Location: 'Location',
  Client: 'Client',
  JobApplication: 'JobApplication',
  Enquiry: 'Enquiry',
  Admission: 'Admission',
  FollowUp: 'FollowUp',
  Allocation: 'Allocation',
  AccountTransaction: 'AccountTransaction',
  Task: 'Task',
  Complaint: 'Complaint',
  WorkflowLog: 'WorkflowLog',
  Approval: 'Approval',
  AuditLog: 'AuditLog',
  FileStorage: 'FileStorage',
  RefCounter: 'RefCounter',
  Blog: 'Blog',
  ClientService: 'ClientService',
  Department: 'Department',
  LabourService: 'LabourService',
  PaymentCategory: 'PaymentCategory',
  Vendor: 'Vendor',
  Room: 'Room',
  VitalSign: 'VitalSign',
  WelcomeCall: 'WelcomeCall',
  Feedback: 'Feedback',
  AutomationRule: 'AutomationRule',
  AutomationWorkflow: 'AutomationWorkflow',
  AutomationScore: 'AutomationScore',
  AutomationTask: 'AutomationTask',
  AutomationLog: 'AutomationLog',
  AutomationSuggestion: 'AutomationSuggestion',
  CommunicationLog: 'CommunicationLog',
  Conversation: 'Conversation',
  Message: 'Message',
  RevenueForecast: 'RevenueForecast',
  AutomationFeedback: 'AutomationFeedback',
  AgentRun: 'AgentRun',
  MessageTemplate: 'MessageTemplate',
  OutboundCampaign: 'OutboundCampaign',
  Patient: 'Patient',
  PatientPortalAccount: 'PatientPortalAccount',
  PatientPortalSession: 'PatientPortalSession',
  Medication: 'Medication',
  Nutrition: 'Nutrition',
  Maintenance: 'Maintenance',
  Laundry: 'Laundry',
  Product: 'Product',
  Stock: 'Stock',
  Purchase: 'Purchase',
  Invoice: 'Invoice',
  Expense: 'Expense',
  Donor: 'Donor',
  Donation: 'Donation',
  DonationReference: 'DonationReference',
  VisitorProfile: 'VisitorProfile',
  VisitorPass: 'VisitorPass',
  ResidentTimeline: 'ResidentTimeline',
  ADLRecord: 'ADLRecord',
  Incident: 'Incident',
  StockIssueRequest: 'StockIssueRequest'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
