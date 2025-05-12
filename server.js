**server.js:**

```javascript
const express = require('express');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// In-memory storage for users (Replace with a database in a real application)
let users = [];
let tickets = []; // Add in-memory storage for tickets
let swapRequests = [];

app.post('/register-user', async (req, res) => {
    const { email, name } = req.body;

    // Basic validation
    if (!email || !name) {
        return res.status(400).send({ message: 'Email and name are required.' });
    }

    //  Check if user with this email already exists.
    const userExists = users.find(user => user.email === email);
    if (userExists) {
        return res.status(409).send({ message: 'Email already exists.' }); // Conflict
    }

    // Simulate user ID generation
    const userId = users.length + 1;

    const newUser = { id: userId, name, email, phone: null };
    users.push(newUser);

    console.log(`User registered: ${name} (${email}) with ID ${userId}`);
    res.status(200).send({ message: 'User registered successfully.', userId: userId });
});

app.get('/user/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    res.status(200).json(user);
});

app.post('/add-ticket', (req, res) => {
    const { name, screeningDate, screeningTime, ownerId } = req.body;

    // Basic validation
    if (!name || !screeningDate || !screeningTime || !ownerId) {
        return res.status(400).send({ message: 'All ticket fields are required.' });
    }

    // Check if the user exists
    const owner = users.find(user => user.id === ownerId);
    if (!owner) {
        return res.status(400).send({ message: 'Invalid owner ID.' });
    }

    const newTicket = {
        id: tickets.length + 1,
        name,
        screeningDate,
        screeningTime,
        ownerId,
        isSwapped: false,
        owner: owner // Include the entire user object
    };

    tickets.push(newTicket);
    console.log(`Ticket added: ${name} (ID: ${newTicket.id}) by User ${ownerId}`);
    res.status(201).send({ message: 'Ticket added successfully.', ticketId: newTicket.id });
});

app.get('/tickets', (req, res) => {
    //  Return tickets and user details
    const ticketsWithUserDetails = tickets.map(ticket => ({
        ...ticket,
        owner: {
            id: ticket.owner.id,
            name: ticket.owner.name,
            email: ticket.owner.email
        }
    }));
    res.status(200).json(ticketsWithUserDetails);
});

app.post('/swap-request', async (req, res) => {
    const { requesterId, requestedTicketId, offeredTicketId, sharePhone } = req.body;

    // Basic validation
      if (!requesterId || !requestedTicketId || !offeredTicketId) {
        return res.status(400).send({ message: 'Missing required information for swap.' });
    }

    const requester = users.find(user => user.id === requesterId);
    const requestedTicket = tickets.find(ticket => ticket.id === requestedTicketId);
    const offeredTicket = tickets.find(ticket => ticket.id === offeredTicketId && ticket.ownerId === requesterId);

    if (!requester) {
        return res.status(400).send({ message: 'Invalid requester ID.' });
    }
    if (!requestedTicket) {
        return res.status(400).send({ message: 'Invalid requested ticket ID.' });
    }
     if (!offeredTicket) {
        return res.status(400).send({ message: 'Invalid offered ticket ID or you do not own this ticket.' });
    }
    if (requestedTicket.isSwapped) {
        return res.status(400).send({ message: 'Ticket already swapped.' });
    }

    // Mark both tickets as swapped
    requestedTicket.isSwapped = true;
    offeredTicket.isSwapped = true;

    // Store the swap request
    const swapRequest = {
        requesterId,
        requestedTicketId,
        offeredTicketId,
        status: 'accepted', // For simplicity, we'll assume it's accepted
        sharePhone,
        timestamp: new Date()
    };
    swapRequests.push(swapRequest);

    let contactInfo = '';
    if (sharePhone && users.find(u => u.id === requestedTicket.ownerId).phone) {
        contactInfo = users.find(u => u.id === requestedTicket.ownerId).phone;
    } else {
        contactInfo = users.find(u => u.id === requestedTicket.ownerId).email;
    }
      const requestedTicketOwner = users.find(user => user.id === requestedTicket.ownerId);

    // Send email notification (optional, requires SendGrid)
    try {
        const msg = {
            to: requestedTicketOwner.email, //  Email of the ticket owner.
            from: 'your-email@example.com',  // Replace with your verified SendGrid email
            subject: 'Ticket Swap Request',
            html: `
                <p>Hello ${requestedTicketOwner.name},</p>
                <p>A user (${requester.name}) has requested to swap a ticket with you for ${requestedTicket.name}.</p>
                <p>Contact them via: ${sharePhone ? 'Phone: ' + contactInfo : 'Email: ' + contactInfo}</p>
            `,
        };

        await sgMail.send(msg);
        console.log(`Swap request email sent to ${requestedTicketOwner.email}`);
    } catch (error) {
        console.error('Error sending swap request email:', error);
        //  Don't block the swap if the email fails.  Log the error.
    }

    res.status(200).send({ message: 'Swap request accepted.', contactInfo: contactInfo });
});

app.get('/swap-requests', (req, res) => {
  res.status(200).json(swapRequests);
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
```

