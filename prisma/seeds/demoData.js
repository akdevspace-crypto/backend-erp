const firstNames = ['Aarav', 'Diya', 'Vivaan', 'Ananya', 'Advik', 'Meera', 'Ishaan', 'Saanvi', 'Reyansh', 'Kavya', 'Arjun', 'Nila', 'Rohan', 'Priya', 'Karthik', 'Lakshmi', 'Naveen', 'Janani', 'Suresh', 'Farah'];
const lastNames = ['Sharma', 'Iyer', 'Menon', 'Rao', 'Nair', 'Kumar', 'Reddy', 'Thomas', 'Krishnan', 'Patel', 'Das', 'Bose', 'Pillai', 'Varma', 'Khan', 'George'];
const streets = ['Race Course Road', 'RS Puram', 'Saibaba Colony', 'Peelamedu', 'Gandhipuram', 'Avinashi Road', 'Singanallur', 'Ganapathy', 'Ukkadam', 'Saravanampatti'];
const roles = ['nurse', 'caregiver', 'admin', 'security', 'cook', 'driver', 'manager'];
const departments = ['Nursing', 'Caregiving', 'Administration', 'Security', 'Kitchen', 'Transport', 'Operations', 'Finance', 'Housekeeping'];
const services = [
    ['HC-ELDER', 'Elder Home Care', 'HOME_CARE', 28000],
    ['HC-NURSE', 'Skilled Nursing', 'CLINICAL', 42000],
    ['HC-PHYSIO', 'Physiotherapy', 'CLINICAL', 18000],
    ['HC-INHOUSE', 'In-House Assisted Living', 'IN_HOUSE', 65000],
    ['HC-DEMENTIA', 'Dementia Care', 'IN_HOUSE', 72000],
    ['HC-POSTOP', 'Post Operative Care', 'CLINICAL', 36000]
];
const productCategories = ['ration', 'fresh food', 'stationary', 'electrical', 'plumbing', 'assets', 'medical'];
const productNames = {
    ration: ['Rice Bag', 'Wheat Flour', 'Toor Dal', 'Cooking Oil', 'Sugar', 'Salt', 'Tea Powder', 'Ragi Flour'],
    'fresh food': ['Tomato Crate', 'Onion Sack', 'Milk Pack', 'Curd Tub', 'Banana Bunch', 'Carrot Bag', 'Greens Bundle'],
    stationary: ['A4 Paper Rim', 'Patient File', 'Marker Set', 'Register Book', 'ID Card Holder', 'Printer Toner'],
    electrical: ['LED Tube Light', 'Switch Board', 'MCB Unit', 'Extension Cable', 'Emergency Light'],
    plumbing: ['PVC Pipe', 'Tap Washer', 'Health Faucet', 'Drain Cleaner', 'Angle Valve'],
    assets: ['Wheelchair', 'Hospital Bed', 'Air Mattress', 'Oxygen Concentrator', 'BP Monitor'],
    medical: ['Gloves Box', 'Syringe Pack', 'Gauze Roll', 'Sanitizer Can', 'Thermometer', 'Pulse Oximeter']
};

const pick = (arr, index) => arr[index % arr.length];
const money = (min, max, index) => Math.round(min + ((index * 7919) % (max - min)));
const daysFromNow = (days, hour = 10) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, (Math.abs(days) * 7) % 60, 0, 0);
    return date;
};
const person = (index) => {
    const firstName = pick(firstNames, index);
    const lastName = pick(lastNames, index * 3);
    return { firstName, lastName, name: `${firstName} ${lastName}` };
};
const phone = (index) => `9${String(100000000 + index * 7391).slice(0, 9)}`;
const emailFor = (name, index) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${index}@demo.erp`;
const statusFor = (index) => pick(['HOT', 'WARM', 'COLD', 'ADMITTED', 'PENDING', 'CLOSED'], index);
const enquiryStatusFor = (status) => {
    if (status === 'CLOSED' || status === 'ADMITTED') return 'CLOSED';
    if (status === 'PENDING') return 'FOLLOW_UP';
    if (status === 'HOT' || status === 'WARM') return 'IN_PROGRESS';
    return 'NEW';
};

async function ensureMasters(prisma, tenantId, unitId) {
    for (let i = 0; i < departments.length; i += 1) {
        await prisma.department.upsert({
            where: { code: `DEMO-DEPT-${String(i + 1).padStart(2, '0')}` },
            update: { totalStaff: i < 7 ? 12 + i * 4 : 8 },
            create: {
                code: `DEMO-DEPT-${String(i + 1).padStart(2, '0')}`,
                name: departments[i],
                head: person(i + 4).name,
                totalStaff: i < 7 ? 12 + i * 4 : 8,
                tenantId,
                unitId
            }
        });
    }

    const serviceRows = [];
    for (const [code, name, category, price] of services) {
        serviceRows.push(await prisma.clientService.upsert({
            where: { code: `DEMO-${code}` },
            update: { name, category, price },
            create: { code: `DEMO-${code}`, name, category, price, tenantId, unitId }
        }));
    }

    for (let i = 0; i < 24; i += 1) {
        await prisma.vendor.upsert({
            where: { code: `DEMO-VEN-${String(i + 1).padStart(3, '0')}` },
            update: {},
            create: {
                code: `DEMO-VEN-${String(i + 1).padStart(3, '0')}`,
                name: `${pick(['CarePlus', 'Sri Lakshmi', 'MediTrust', 'FreshKart', 'SecureGate', 'PrimeFix'], i)} ${pick(['Supplies', 'Agencies', 'Traders', 'Foods', 'Services'], i)}`,
                category: pick(['Pharmacy', 'Groceries', 'Housekeeping', 'Electrical', 'Plumbing', 'Medical', 'Security'], i),
                contact: phone(700 + i),
                status: i % 5 !== 0,
                tenantId,
                unitId
            }
        });
    }

    for (let i = 0; i < 40; i += 1) {
        await prisma.room.upsert({
            where: { code: `DEMO-RM-${String(i + 1).padStart(3, '0')}` },
            update: {},
            create: {
                code: `DEMO-RM-${String(i + 1).padStart(3, '0')}`,
                type: pick(['Single Care', 'Twin Sharing', 'Critical Observation', 'Memory Care'], i),
                capacity: i % 4 === 0 ? 1 : 2,
                status: i % 9 !== 0,
                tenantId,
                unitId
            }
        });
    }

    for (let i = 0; i < 14; i += 1) {
        await prisma.paymentCategory.upsert({
            where: { code: `DEMO-PAY-${String(i + 1).padStart(2, '0')}` },
            update: {},
            create: {
                code: `DEMO-PAY-${String(i + 1).padStart(2, '0')}`,
                name: pick(['Monthly Care Fee', 'Medication Recovery', 'Nursing Advance', 'Food & Diet', 'Maintenance', 'Utilities', 'Payroll', 'Vendor Payment'], i),
                type: i % 3 === 0 ? 'EXPENSE' : 'INCOME',
                description: 'Demo finance category for analytics and approval flows',
                tenantId,
                unitId
            }
        });
    }

    return serviceRows;
}

async function seedStaff(prisma, tenantId, unitId) {
    const existing = await prisma.staff.count({ where: { empId: { startsWith: 'DEMO-STF-' } } });
    if (existing >= 120) return prisma.staff.findMany({ where: { empId: { startsWith: 'DEMO-STF-' } }, take: 120 });

    const rows = [];
    for (let i = existing; i < 120; i += 1) {
        const p = person(i);
        rows.push(await prisma.staff.upsert({
            where: { empId: `DEMO-STF-${String(i + 1).padStart(3, '0')}` },
            update: {},
            create: {
                empId: `DEMO-STF-${String(i + 1).padStart(3, '0')}`,
                firstName: p.firstName,
                lastName: p.lastName,
                designation: pick(roles, i),
                department: pick(departments, i),
                phone: phone(i),
                email: emailFor(p.name, i),
                joiningDate: daysFromNow(-900 + i * 5),
                status: i % 17 === 0 ? 'On Leave' : 'Working',
                photoUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}`,
                skills: [pick(['elder care', 'vitals', 'dementia', 'first aid', 'diet tracking', 'mobility'], i), pick(['night shift', 'Tamil', 'English', 'Hindi', 'critical care'], i + 2)],
                location: pick(['Block A', 'Block B', 'Kitchen', 'Front Gate', 'Field Duty'], i),
                isAvailable: i % 6 !== 0,
                performanceScore: 58 + (i % 39),
                workload: i % 9,
                currentWorkload: i % 6,
                shiftStart: i % 2 === 0 ? '08:00' : '20:00',
                shiftEnd: i % 2 === 0 ? '20:00' : '08:00',
                capacity: 4 + (i % 5),
                stressLevel: Number(((i % 10) / 10).toFixed(1)),
                lastActiveAt: daysFromNow(-(i % 4), 9 + (i % 10)),
                metadata: { demo: true, role: pick(roles, i), bloodGroup: pick(['O+', 'A+', 'B+', 'AB+'], i) },
                tenantId,
                unitId
            }
        }));
    }
    return prisma.staff.findMany({ where: { empId: { startsWith: 'DEMO-STF-' } }, take: 120 });
}

async function seedCrmAndHealthcare(prisma, tenantId, unitId, servicesRows, staffRows, adminUser) {
    const existing = await prisma.enquiry.count({ where: { refNo: { startsWith: 'DEMO-ENQ-' } } });
    if (existing >= 150) {
        return {
            clients: await prisma.client.findMany({ where: { refNo: { startsWith: 'DEMO-CLI-' } }, take: 170 }),
            enquiries: await prisma.enquiry.findMany({ where: { refNo: { startsWith: 'DEMO-ENQ-' } }, take: 150 })
        };
    }

    const clients = [];
    for (let i = 0; i < 170; i += 1) {
        const p = person(i + 100);
        clients.push(await prisma.client.upsert({
            where: { refNo: `DEMO-CLI-${String(i + 1).padStart(4, '0')}` },
            update: {},
            create: {
                refNo: `DEMO-CLI-${String(i + 1).padStart(4, '0')}`,
                name: p.name,
                mobile: phone(200 + i),
                email: emailFor(p.name, i),
                address: `${12 + i}, ${pick(streets, i)}, Coimbatore`,
                tenantId,
                unitId,
                createdAt: daysFromNow(-120 + (i % 100))
            }
        }));
    }

    const enquiries = [];
    for (let i = 0; i < 150; i += 1) {
        const leadStatus = i < 50 ? 'ADMITTED' : statusFor(i);
        const service = pick(servicesRows, i);
        const raw = {
            patientName: person(i + 400).name,
            patientAge: 62 + (i % 31),
            patientGender: i % 2 === 0 ? 'Male' : 'Female',
            assignedStaff: `${pick(staffRows, i).firstName} ${pick(staffRows, i).lastName || ''}`.trim(),
            highValueLead: i % 8 === 0,
            followupDate: daysFromNow((i % 11) - 5).toISOString()
        };
        const enquiry = await prisma.enquiry.upsert({
            where: { refNo: `DEMO-ENQ-${String(i + 1).padStart(4, '0')}` },
            update: {},
            create: {
                refNo: `DEMO-ENQ-${String(i + 1).padStart(4, '0')}`,
                clientId: clients[i].id,
                serviceId: service.id,
                mode: pick(['Call', 'Website', 'Walk-in', 'WhatsApp', 'Email'], i),
                source: pick(['Google Ads', 'Referral', 'Hospital Partner', 'Website', 'Walk-in', 'WhatsApp'], i),
                channelId: `demo-channel-${i + 1}`,
                rawMessage: JSON.stringify(raw),
                description: `${raw.patientName} needs ${service.name.toLowerCase()} support. ${i % 7 === 0 ? 'Family requested urgent assessment today.' : 'Follow up with care plan and pricing.'}`,
                status: enquiryStatusFor(leadStatus),
                priority: leadStatus,
                intent: i % 10 === 0 ? 'emergency' : 'enquiry',
                sentiment: i % 9 === 0 ? 'anxious' : 'positive',
                summary: `${leadStatus} lead for ${service.name}`,
                urgency: i % 10 === 0 ? 'CRITICAL' : pick(['LOW', 'MEDIUM', 'HIGH'], i),
                isConverted: leadStatus === 'ADMITTED',
                convertedAt: leadStatus === 'ADMITTED' ? daysFromNow(-40 + (i % 35)) : null,
                tenantId,
                unitId,
                createdAt: daysFromNow(-100 + (i % 90), 8 + (i % 8))
            }
        });
        enquiries.push(enquiry);

        await prisma.followUp.create({
            data: {
                enquiryId: enquiry.id,
                notes: i % 6 === 0 ? 'Overdue urgent follow-up: family asked for bed availability.' : 'Discussed package, medical condition, and next assessment slot.',
                scheduledAt: daysFromNow((i % 13) - 6, 10 + (i % 8)),
                actualAt: i % 4 === 0 ? daysFromNow((i % 13) - 7, 11) : null,
                channel: pick(['CALL', 'WHATSAPP', 'EMAIL'], i),
                response: i % 5 !== 0,
                converted: leadStatus === 'ADMITTED',
                outcome: leadStatus === 'ADMITTED' ? 'CONVERTED' : pick(['PENDING', 'INTERESTED', 'CALL_BACK', 'DOCUMENTS_REQUESTED'], i),
                successScore: 35 + (i % 60),
                clientInterest: pick(['High', 'Medium', 'Low'], i),
                readyToPayAmount: i % 8 === 0 ? money(50000, 160000, i) : null,
                paymentMode: pick(['UPI', 'Cash', 'Card', 'Bank Transfer'], i),
                nextFollowupStatus: i % 6 === 0 ? 'OVERDUE' : 'SCHEDULED',
                tenantId,
                unitId
            }
        });

        await prisma.automationScore.upsert({
            where: { entityId_module: { entityId: enquiry.id, module: 'enquiry' } },
            update: {},
            create: {
                entityId: enquiry.id,
                module: 'enquiry',
                score: leadStatus === 'HOT' || leadStatus === 'ADMITTED' ? 82 + (i % 15) : 35 + (i % 45),
                label: leadStatus === 'ADMITTED' ? 'HOT' : leadStatus,
                probability: Number((0.45 + (i % 50) / 100).toFixed(2)),
                confidence: Number((0.72 + (i % 20) / 100).toFixed(2)),
                historyScore: 40 + (i % 45),
                factors: { source: pick(['fast response', 'budget match', 'urgent condition', 'referral'], i), demo: true },
                tenantId,
                unitId
            }
        });
    }

    const admitted = enquiries.slice(0, 50);
    for (let i = 0; i < 80; i += 1) {
        const p = person(i + 500);
        const patient = await prisma.patient.create({
            data: { name: p.name, tenantId, unitId, createdAt: daysFromNow(-75 + i) }
        });

        if (i < admitted.length) {
            await prisma.admission.create({
                data: {
                    enquiryId: admitted[i].id,
                    patientId: patient.id,
                    tenantId,
                    unitId,
                    status: i % 12 === 0 ? 'OBSERVATION' : 'ACTIVE',
                    admittedAt: daysFromNow(-60 + i)
                }
            });
        }

        await prisma.vitalSign.create({
            data: {
                patientId: patient.id,
                bp: i % 4 === 0 ? '168/98' : `${112 + (i % 22)}/${72 + (i % 13)}`,
                pulse: i % 5 === 0 ? 118 : 68 + (i % 28),
                temp: i % 6 === 0 ? 101.4 : 97.5 + ((i % 18) / 10),
                spO2: i % 7 === 0 ? 88 : 94 + (i % 6),
                notes: i < 20 ? 'Critical flag: review vitals and medication schedule.' : 'Routine monitoring completed.',
                recordedById: adminUser.id,
                tenantId,
                unitId,
                createdAt: daysFromNow(-(i % 4), 7 + (i % 10))
            }
        });

        await prisma.medication.create({
            data: {
                patientId: patient.id,
                name: pick(['Amlodipine', 'Metformin', 'Atorvastatin', 'Pantoprazole', 'Vitamin D3', 'Nebulization'], i),
                dosage: pick(['1-0-1', '0-1-0', '1-0-0', 'SOS', 'Before food'], i)
            }
        });
        await prisma.nutrition.create({
            data: {
                patientId: patient.id,
                calories: 1400 + (i % 8) * 100,
                dietPlan: pick(['Diabetic soft diet', 'High protein plan', 'Low sodium diet', 'Renal diet', 'Normal assisted diet'], i)
            }
        });
        await prisma.laundry.create({
            data: {
                patientId: patient.id,
                status: pick(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'ESCALATED'], i),
                tenantId,
                unitId,
                createdAt: daysFromNow(-(i % 14))
            }
        });
    }

    for (let i = 0; i < 60; i += 1) {
        await prisma.allocation.upsert({
            where: { refNo: `DEMO-ALC-${String(i + 1).padStart(4, '0')}` },
            update: {},
            create: {
                refNo: `DEMO-ALC-${String(i + 1).padStart(4, '0')}`,
                enquiryId: enquiries[i].id,
                type: pick(['HOME_CARE', 'CLINICAL', 'IN_HOUSE', 'OTHERS'], i),
                staffId: pick(staffRows, i).id,
                startDate: daysFromNow(-30 + (i % 20)),
                endDate: daysFromNow(5 + (i % 35)),
                status: pick(['PENDING', 'ALLOCATED', 'ON_HOLD', 'COMPLETED'], i),
                metadata: { roomNo: `DEMO-RM-${String((i % 40) + 1).padStart(3, '0')}`, demo: true },
                allocationScore: 60 + (i % 35),
                tenantId,
                unitId
            }
        });
    }

    return { clients, enquiries };
}

async function seedInventoryFinanceOps(prisma, tenantId, unitId, clients) {
    const productCount = await prisma.product.count({ where: { name: { startsWith: 'Demo ' } } });
    if (productCount < 500) {
        for (let i = productCount; i < 500; i += 1) {
            const category = pick(productCategories, i);
            const product = await prisma.product.create({
                data: {
                    name: `Demo ${pick(productNames[category], i)} ${String(i + 1).padStart(3, '0')}`,
                    category,
                    tenantId,
                    unitId
                }
            });
            const quantity = i % 11 === 0 ? 2 + (i % 6) : 25 + (i % 180);
            await prisma.stock.create({ data: { productId: product.id, quantity, tenantId, unitId } });
            if (i % 3 === 0) {
                await prisma.purchase.create({
                    data: {
                        productId: product.id,
                        quantity: 20 + (i % 120),
                        vendor: `${pick(['CarePlus', 'FreshKart', 'MediTrust', 'PrimeFix'], i)} ${pick(['Supplies', 'Foods', 'Agencies'], i)}`,
                        tenantId,
                        unitId,
                        createdAt: daysFromNow(-(i % 45))
                    }
                });
            }
        }
    }

    const txnCount = await prisma.accountTransaction.count({ where: { refNo: { startsWith: 'DEMO-TXN-' } } });
    for (let i = txnCount; i < 220; i += 1) {
        await prisma.accountTransaction.upsert({
            where: { refNo: `DEMO-TXN-${String(i + 1).padStart(4, '0')}` },
            update: {},
            create: {
                refNo: `DEMO-TXN-${String(i + 1).padStart(4, '0')}`,
                type: pick(['INVOICE', 'RECEIPT', 'EXPENSE', 'REFUND'], i),
                amount: money(1200, 98000, i),
                paymentMode: pick(['Cash', 'UPI', 'Card', 'Bank Transfer'], i),
                category: pick(['Monthly Care Fee', 'Medication', 'Ration', 'Payroll', 'Maintenance', 'Advance'], i),
                clientName: clients.length ? pick(clients, i).name : person(i).name,
                status: pick(['CREATED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REJECTED'], i),
                notes: pick(['paid', 'pending', 'overdue', 'partial payment', 'monthly trend sample'], i),
                date: daysFromNow(-120 + (i % 110)),
                tenantId,
                unitId
            }
        });
    }

    const invoiceCount = await prisma.invoice.count({ where: { tenantId, unitId } });
    for (let i = invoiceCount; i < 140; i += 1) {
        await prisma.invoice.create({
            data: {
                amount: money(8000, 125000, i),
                status: pick(['paid', 'pending', 'overdue', 'partial payment'], i),
                tenantId,
                unitId,
                createdAt: daysFromNow(-160 + (i % 150))
            }
        });
    }

    const expenseCount = await prisma.expense.count({ where: { tenantId, unitId } });
    for (let i = expenseCount; i < 160; i += 1) {
        await prisma.expense.create({
            data: {
                amount: money(600, 56000, i),
                category: pick(['Ration', 'Medical', 'Maintenance', 'Laundry', 'Payroll', 'Utilities', 'Transport'], i),
                tenantId,
                unitId,
                createdAt: daysFromNow(-150 + (i % 140))
            }
        });
    }

    const maintenanceCount = await prisma.maintenance.count({ where: { tenantId, unitId } });
    for (let i = maintenanceCount; i < 80; i += 1) {
        await prisma.maintenance.create({
            data: {
                type: pick(['AC repair', 'Bed rail check', 'Bathroom plumbing', 'Generator service', 'Lift inspection', 'Nurse call bell'], i),
                status: pick(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'ESCALATED'], i),
                tenantId,
                unitId,
                createdAt: daysFromNow(-(i % 45))
            }
        });
    }
}

async function seedHrOpsSecurityOmni(prisma, tenantId, unitId, staffRows, clients, enquiries, adminUser) {
    const jobCount = await prisma.jobApplication.count({ where: { applicationNo: { startsWith: 'DEMO-JOB-' } } });
    for (let i = jobCount; i < 70; i += 1) {
        const p = person(i + 900);
        await prisma.jobApplication.upsert({
            where: { applicationNo: `DEMO-JOB-${String(i + 1).padStart(4, '0')}` },
            update: {},
            create: {
                applicationNo: `DEMO-JOB-${String(i + 1).padStart(4, '0')}`,
                companyUnit: 'Universal Elder Care',
                applyFor: pick(roles, i),
                experience: `${1 + (i % 12)} years`,
                location: pick(['Coimbatore', 'Tiruppur', 'Erode', 'Salem'], i),
                applicantName: p.name,
                mobileNo: phone(1100 + i),
                email: emailFor(p.name, i),
                followupStatus: pick(['Screening', 'Interview', 'Offer', 'Rejected', 'Pending'], i),
                interestStatus: pick(['High', 'Neutral', 'Low'], i),
                tenantId,
                unitId,
                createdAt: daysFromNow(-50 + i)
            }
        });
    }

    const taskCount = await prisma.task.count({ where: { refNo: { startsWith: 'DEMO-TSK-' } } });
    for (let i = taskCount; i < 130; i += 1) {
        await prisma.task.upsert({
            where: { refNo: `DEMO-TSK-${String(i + 1).padStart(4, '0')}` },
            update: {},
            create: {
                refNo: `DEMO-TSK-${String(i + 1).padStart(4, '0')}`,
                title: pick(['Medication round', 'ADL bath assist', 'Diet audit', 'Room sanitation', 'Gate verification', 'Laundry dispatch', 'Follow-up call'], i),
                description: 'Operational demo task for daily approval and schedule tracking.',
                priority: pick(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], i),
                enquiryId: enquiries.length ? pick(enquiries, i).id : null,
                assigneeId: adminUser.id,
                assignedStaffId: pick(staffRows, i).id,
                approvalAuthorityId: adminUser.id,
                type: i % 3 === 0 ? 'SCHEDULED' : 'DAILY',
                dueDate: daysFromNow((i % 16) - 8),
                status: pick(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED'], i),
                completedAt: i % 3 === 0 ? daysFromNow(-1 * (i % 8)) : null,
                feedbackScore: 3 + (i % 3),
                tenantId,
                unitId
            }
        });
    }

    const complaintCount = await prisma.complaint.count({ where: { refNo: { startsWith: 'DEMO-CMP-' } } });
    for (let i = complaintCount; i < 80; i += 1) {
        await prisma.complaint.upsert({
            where: { refNo: `DEMO-CMP-${String(i + 1).padStart(4, '0')}` },
            update: {},
            create: {
                refNo: `DEMO-CMP-${String(i + 1).padStart(4, '0')}`,
                title: pick(['Food temperature concern', 'Delayed nurse visit', 'Billing clarification', 'Laundry mix-up', 'Medication timing issue'], i),
                type: pick(['Service', 'Care', 'Billing', 'Facility'], i),
                description: 'Demo complaint captured from customer care channel.',
                status: pick(['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED'], i),
                priority: pick(['LOW', 'MEDIUM', 'HIGH'], i),
                sentiment: pick(['neutral', 'negative', 'anxious'], i),
                urgency: i % 6 === 0 ? 'HIGH' : 'MEDIUM',
                serviceTag: pick(['care', 'food', 'billing', 'housekeeping'], i),
                channel: pick(['call', 'email', 'whatsapp'], i),
                channelId: `DEMO-CCH-${i + 1}`,
                metadata: { demo: true, escalation: i % 8 === 0 },
                tenantId,
                unitId
            }
        });
    }

    const convCount = await prisma.conversation.count({ where: { tenantId, unitId, externalThreadId: { startsWith: 'DEMO-THREAD-' } } });
    for (let i = convCount; i < 90; i += 1) {
        const client = clients.length ? pick(clients, i) : null;
        const enquiry = enquiries.length ? pick(enquiries, i) : null;
        const channel = pick(['email', 'whatsapp', 'sms', 'call'], i);
        const conversation = await prisma.conversation.create({
            data: {
                entityType: 'enquiry',
                entityId: enquiry?.id || `demo-entity-${i}`,
                clientId: client?.id,
                enquiryId: enquiry?.id,
                channel,
                lastInboundChannel: channel,
                subject: pick(['Care plan follow-up', 'Admission documents', 'Invoice clarification', 'Medication update', 'Missed call callback'], i),
                externalThreadId: `DEMO-THREAD-${String(i + 1).padStart(4, '0')}`,
                lastMessageAt: daysFromNow(-(i % 15), 8 + (i % 10)),
                status: pick(['OPEN', 'WAITING', 'RESOLVED', 'CLOSED'], i),
                metadata: { unread: i % 4 === 0, escalated: i % 11 === 0, missedCall: channel === 'call' && i % 3 === 0 },
                tenantId,
                unitId
            }
        });

        await prisma.channelIdentity.create({
            data: {
                externalUserId: `${channel}:${client?.mobile || phone(i)}`,
                channel,
                clientId: client?.id || clients[0].id,
                conversationId: conversation.id,
                tenantId,
                unitId
            }
        }).catch(() => null);

        for (let m = 0; m < 4; m += 1) {
            const inbound = m % 2 === 0;
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    direction: inbound ? 'INBOUND' : 'OUTBOUND',
                    channel,
                    sender: inbound ? client?.mobile || 'customer' : 'care-desk',
                    recipient: inbound ? 'care-desk' : client?.mobile || 'customer',
                    body: inbound
                        ? pick(['Need update on admission bed availability.', 'Please share diet chart.', 'Can someone call back?', 'Payment completed, sharing screenshot.'], i + m)
                        : pick(['We will arrange a callback shortly.', 'Diet chart has been shared.', 'Admission coordinator will contact you.', 'Payment receipt is updated.'], i + m),
                    status: pick(['QUEUED', 'SENT', 'DELIVERED', 'READ'], i + m),
                    deliveryStatus: pick(['sent', 'delivered', 'read', 'failed'], i + m),
                    sentAt: daysFromNow(-(i % 15), 8 + m),
                    deliveredAt: daysFromNow(-(i % 15), 9 + m),
                    readAt: (i + m) % 3 === 0 ? null : daysFromNow(-(i % 15), 10 + m),
                    metadata: { demo: true, escalated: i % 11 === 0 && m === 3 },
                    tenantId,
                    unitId
                }
            });
        }

        await prisma.communicationLog.create({
            data: {
                entityType: 'enquiry',
                entityId: enquiry?.id || conversation.id,
                conversationId: conversation.id,
                channel,
                channelId: `DEMO-COMM-${i + 1}`,
                direction: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
                message: 'Demo omnichannel delivery/read status event.',
                status: pick(['sent', 'delivered', 'read', 'missed', 'failed'], i),
                externalMessageId: `DEMO-EXT-${i + 1}-${Date.now()}`,
                metadata: { readStatus: i % 3 === 0 ? 'unread' : 'read', deliveryStatus: pick(['sent', 'delivered', 'read'], i) },
                rawPayload: { demo: true },
                tenantId,
                unitId,
                createdAt: daysFromNow(-(i % 30))
            }
        });
    }

    const securityModules = [
        ['SECURITY', 'VISITOR_ENTRY', 'Visitor checked in for patient visit'],
        ['SECURITY', 'GATE_LOG', 'Ambulance gate movement recorded'],
        ['SECURITY', 'OTP_VERIFICATION', 'OTP verified for medicine handover'],
        ['SECURITY', 'ALERT', 'Restricted area access alert']
    ];
    const auditCount = await prisma.auditLog.count({ where: { module: 'SECURITY', tenantId, unitId } });
    for (let i = auditCount; i < 120; i += 1) {
        const [module, action, note] = pick(securityModules, i);
        await prisma.auditLog.create({
            data: {
                userId: adminUser.id,
                module,
                action,
                payload: {
                    visitorName: person(i + 1200).name,
                    entryTime: daysFromNow(-(i % 20), 9 + (i % 8)).toISOString(),
                    exitTime: i % 5 === 0 ? null : daysFromNow(-(i % 20), 11 + (i % 8)).toISOString(),
                    host: pick(staffRows, i).firstName,
                    purpose: pick(['Patient visit', 'Vendor delivery', 'Interview', 'Maintenance', 'Medicine handover'], i),
                    note
                },
                tenantId,
                unitId,
                createdAt: daysFromNow(-(i % 20), 9 + (i % 8))
            }
        });
    }
}

async function seedAnalytics(prisma, tenantId, unitId, enquiries) {
    const forecastCount = await prisma.revenueForecast.count({ where: { tenantId, unitId } });
    for (let i = forecastCount; i < 12; i += 1) {
        const periodStart = new Date(new Date().getFullYear(), i, 1);
        const periodEnd = new Date(new Date().getFullYear(), i + 1, 0);
        await prisma.revenueForecast.create({
            data: {
                tenantId,
                unitId,
                forecastDate: new Date(),
                periodStart,
                periodEnd,
                expectedRevenue: 480000 + i * 45000,
                projectedRevenue: 520000 + i * 52000,
                baselineRevenue: 420000 + i * 38000,
                pipelineRevenue: 260000 + i * 25000,
                growthRate: Number((8 + i * 1.3).toFixed(2)),
                confidence: Number((0.72 + (i % 5) / 100).toFixed(2)),
                contributingData: {
                    admissionsThisMonth: 8 + (i % 9),
                    lowStockAlerts: 18 + (i % 12),
                    criticalPatients: 12 + (i % 8),
                    revenueGrowth: `${8 + i}%`
                },
                reasoning: 'Demo forecast generated from seeded admissions, invoices, and pipeline value.'
            }
        });
    }

    const automationTaskCount = await prisma.automationTask.count({
        where: {
            tenantId,
            unitId,
            module: 'enquiry',
            description: 'Demo automation task for dashboard activity feed.'
        }
    });
    for (let i = automationTaskCount; i < Math.min(enquiries.length, 80); i += 1) {
        await prisma.automationTask.create({
            data: {
                entityId: enquiries[i].id,
                module: 'enquiry',
                taskType: pick(['FOLLOW_UP', 'SCORE_REVIEW', 'ALLOCATION', 'PAYMENT_REMINDER'], i),
                description: 'Demo automation task for dashboard activity feed.',
                assignedTo: 'care-desk',
                status: pick(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'], i),
                priority: i % 5,
                metadata: { demo: true, heatmapBucket: pick(['morning', 'afternoon', 'evening'], i) },
                scheduledAt: daysFromNow((i % 14) - 7),
                tenantId,
                unitId
            }
        });
    }
}

async function seedBlogs(prisma, tenantId, unitId) {
    const blogCount = await prisma.blog.count({ where: { tenantId, unitId } });
    if (blogCount >= 10) return;

    const sampleBlogs = [
        {
            title: 'Enhancing Elder Care through Technology',
            date: '2026-05-01',
            keywords: 'elder care, technology, AI',
            description: 'Exploration of how AI and smart monitoring are revolutionizing assisted living environments.',
            unitName: 'Universal Edler Care - Coimbatore',
            status: 'Published'
        },
        {
            title: 'The Importance of Specialized Dementia Care',
            date: '2026-05-03',
            keywords: 'dementia, memory care, therapy',
            description: 'Understanding the unique needs of residents with cognitive impairment and our specialized approach.',
            unitName: 'Universal Edler Care - Coimbatore',
            status: 'Published'
        },
        {
            title: 'Nutrition Tips for Healthy Aging',
            date: '2026-05-05',
            keywords: 'nutrition, aging, health',
            description: 'Our dietician shares key nutritional strategies for maintaining vitality in the golden years.',
            unitName: 'Universal Edler Care - Coimbatore',
            status: 'Published'
        },
        {
            title: 'Community Events: Spring Festival 2026',
            date: '2026-04-15',
            keywords: 'community, festival, celebration',
            description: 'A look back at our vibrant Spring Festival celebration with residents and families.',
            unitName: 'Universal Edler Care - Coimbatore',
            status: 'Published'
        },
        {
            title: 'New Physical Therapy Wing Opening',
            date: '2026-05-10',
            keywords: 'therapy, rehabilitation, wing',
            description: 'Announcing the opening of our state-of-the-art physical therapy unit for resident recovery.',
            unitName: 'Universal Edler Care - Coimbatore',
            status: 'Draft'
        }
    ];

    for (const blog of sampleBlogs) {
        await prisma.blog.create({
            data: {
                ...blog,
                tenantId,
                unitId
            }
        });
    }
}

export async function seedDemoData(prisma, tenant, unit, adminUser) {
    console.log('Seeding realistic ERP demo data...');
    const servicesRows = await ensureMasters(prisma, tenant.id, unit.id);
    const staffRows = await seedStaff(prisma, tenant.id, unit.id);
    const { clients, enquiries } = await seedCrmAndHealthcare(prisma, tenant.id, unit.id, servicesRows, staffRows, adminUser);
    await seedInventoryFinanceOps(prisma, tenant.id, unit.id, clients);
    await seedHrOpsSecurityOmni(prisma, tenant.id, unit.id, staffRows, clients, enquiries, adminUser);
    await seedAnalytics(prisma, tenant.id, unit.id, enquiries);
    await seedBlogs(prisma, tenant.id, unit.id);
    console.log('Realistic ERP demo data is ready.');
}

