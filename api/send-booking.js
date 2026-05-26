// Replaced nodemailer with native fetch for Brevo API

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { type, name, email, phone, details } = req.body;

        if (!name || !email || !phone || !type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, email, phone, and booking type are required' 
            });
        }

        // Build email content based on booking type
        let subject = '';
        let htmlBody = '';

        const headerStyle = `
            background: linear-gradient(135deg, #0f4c3a 0%, #1a7a5c 50%, #2dd4a8 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 12px 12px 0 0;
        `;

        const baseTemplate = (title, content) => `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12);">
            <div style="${headerStyle}">
                <h1 style="margin: 0; font-size: 24px;">🏔️ Book&Sync — New Booking Request</h1>
                <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${title}</p>
            </div>
            <div style="padding: 24px; background: #ffffff;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Customer Name</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${name}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Email</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${email}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Phone</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${phone}</td>
                    </tr>
                    ${content}
                </table>
            </div>
            <div style="padding: 16px 24px; background: #f9fafb; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">This booking was submitted via Book&Sync Yercaud Platform</p>
            </div>
        </div>`;

        switch (type) {
            case 'room':
                subject = `🏨 Room Booking — ${name}`;
                htmlBody = baseTemplate('Room / Resort Booking', `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Room Type</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.roomType || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Check-in</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.checkIn || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Check-out</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.checkOut || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Guests</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.guests || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Special Requests</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.notes || 'None'}</td>
                    </tr>
                `);
                break;

            case 'taxi':
                subject = `🚕 Taxi Booking — ${name}`;
                htmlBody = baseTemplate('Taxi / Tour Booking', `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Service Type</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.serviceType || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Pickup Location</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.pickup || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Drop Location</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.drop || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Date & Time</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.dateTime || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Notes</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.notes || 'None'}</td>
                    </tr>
                `);
                break;

            case 'trip':
                subject = `🗺️ Trip Plan Request — ${name}`;
                htmlBody = baseTemplate('Trip Planner Booking', `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Duration</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.duration || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Travel Date</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.travelDate || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Budget</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.budget || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Group Size</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.groupSize || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Interests</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.interests || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Special Notes</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.notes || 'None'}</td>
                    </tr>
                `);
                break;

            case 'proposal':
            case 'anniversary':
            case 'birthday':
                const eventName = type.charAt(0).toUpperCase() + type.slice(1);
                subject = `🎉 ${eventName} Request — ${name}`;
                htmlBody = baseTemplate(`${eventName} Event Booking`, `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Setup Preference</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.setupPreference || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Event Date</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.date || 'Not specified'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Special Notes</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.notes || 'None'}</td>
                    </tr>
                `);
                break;

            case 'custom':
                subject = `✨ Custom Service Request — ${name}`;
                htmlBody = baseTemplate('Custom Service Request', `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Custom Requirement</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.requirement || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Tentative Date</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.date || 'Not specified'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Additional Notes</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.notes || 'None'}</td>
                    </tr>
                `);
                break;

            default:
                subject = `📩 General Inquiry — ${name}`;
                htmlBody = baseTemplate('General Inquiry', `
                    <tr>
                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Message</td>
                        <td style="padding: 12px 0; font-weight: 600; text-align: right;">${details.notes || 'No message'}</td>
                    </tr>
                `);
        }

        // Helper function to send email via Brevo REST API
        const sendBrevoEmail = async (toEmail, toName, subj, htmlContent) => {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': process.env.BREVO_API_KEY,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: {
                        name: process.env.BREVO_SENDER_NAME || 'Book&Sync',
                        email: process.env.BREVO_SENDER_EMAIL
                    },
                    to: [{ email: toEmail, name: toName }],
                    subject: subj,
                    htmlContent: htmlContent
                })
            });
            
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Brevo API Error: ${err}`);
            }
            return response.json();
        };

        // 1. Send email to business owner
        await sendBrevoEmail(
            process.env.REPORT_RECEIVER_EMAIL || 'sureshit2005@gmail.com',
            'Business Owner',
            subject,
            htmlBody
        );

        // 2. Send confirmation to customer
        const customerHtml = `
            <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12);">
                <div style="${headerStyle}">
                    <h1 style="margin: 0; font-size: 24px;">🏔️ Book&Sync Yercaud</h1>
                    <p style="margin: 8px 0 0; opacity: 0.9;">Your booking request has been received!</p>
                </div>
                <div style="padding: 24px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151;">Hi <strong>${name}</strong>,</p>
                    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
                        Thank you for choosing Book&Sync! We've received your booking request and our team will get back to you within <strong>2 hours</strong> to confirm your reservation.
                    </p>
                    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0; font-size: 14px; color: #15803d;">📞 For urgent queries, call us at <strong>+91 82206 79754</strong></p>
                    </div>
                </div>
                <div style="padding: 16px 24px; background: #f9fafb; text-align: center; border-radius: 0 0 12px 12px;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Book&Sync — Your Complete Yercaud Experience</p>
                </div>
            </div>`;

        await sendBrevoEmail(
            email,
            name,
            `✅ Booking Received — Book&Sync`,
            customerHtml
        );

        return res.status(200).json({ 
            success: true, 
            message: 'Booking request sent successfully! Check your email for confirmation.' 
        });

    } catch (error) {
        console.error('Booking Email Error:', error);

        return res.status(500).json({ 
            success: false, 
            error: 'Failed to send booking. Please try again or call us directly.' 
        });
    }
};
