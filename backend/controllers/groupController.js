const db = require('../config/db');
const { saveBase64Image } = require('../utils/fileHelper');

// 1. Create Group
exports.createGroup = async (req, res) => {
    const { name, description, is_private, image_url } = req.body;
    const userId = req.user.id;

    let finalImageUrl = image_url;
    if (image_url && image_url.startsWith('data:image')) {
        finalImageUrl = saveBase64Image(image_url, 'groups');
    }

    try {
        const [result] = await db.query(
            'INSERT INTO groups_list (name, description, created_by, is_private, image_url) VALUES (?, ?, ?, ?, ?)',
            [name, description, userId, is_private || false, finalImageUrl]
        );
        const groupId = result.insertId;

        // Add creator as admin
        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, userId, 'admin']
        );

        res.status(201).json({ status: 'success', message: 'Group created successfully', groupId });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 2. Get My Groups (With unread count)
exports.getMyGroups = async (req, res) => {
    const userId = req.user.id;
    try {
        const [groups] = await db.query(
            `SELECT g.*, gm.role, gm.last_read_id,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            (SELECT COUNT(*) FROM group_messages_v2 WHERE group_id = g.id AND id > gm.last_read_id) as unread_count,
            (SELECT message FROM group_messages_v2 WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT created_at FROM group_messages_v2 WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time
            FROM groups_list g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ? AND g.is_active = TRUE
            ORDER BY last_message_time DESC`,
            [userId]
        );
        res.json(groups);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 3. Get All Public Groups
exports.getAllPublicGroups = async (req, res) => {
    const userId = req.user.id;
    const { search } = req.query;
    try {
        let query = `SELECT g.*, 
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member
            FROM groups_list g 
            WHERE g.is_private = FALSE AND g.is_active = TRUE`;
        
        const params = [userId];
        if (search) {
            query += ' AND (g.name LIKE ? OR g.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [groups] = await db.query(query, params);
        res.json(groups);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 4. Join Group
exports.joinGroup = async (req, res) => {
    const { groupId } = req.body;
    const userId = req.user.id;
    try {
        const [group] = await db.query('SELECT is_private FROM groups_list WHERE id = ?', [groupId]);
        if (!group.length) return res.status(404).json({ message: 'Group not found' });
        if (group[0].is_private) return res.status(403).json({ message: 'This is a private group' });

        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, userId, 'member']
        );
        res.json({ status: 'success', message: 'Joined successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 5. Add Member (Admin only)
exports.addMember = async (req, res) => {
    const { groupId, targetUserId } = req.body;
    const userId = req.user.id;

    try {
        const [adminCheck] = await db.query(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        if (!adminCheck.length || adminCheck[0].role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can add members' });
        }

        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, targetUserId, 'member']
        );
        res.json({ status: 'success', message: 'Member added' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 6. Get Group Messages (Update last_read_id)
exports.getGroupMessages = async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.id;

    try {
        const [memberCheck] = await db.query(
            'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        if (!memberCheck.length) return res.status(403).json({ message: 'Not a member' });

        const [messages] = await db.query(
            `SELECT m.*, u.name as sender_name, u.username as sender_username, u.profile_picture as sender_avatar
            FROM group_messages_v2 m
            JOIN users u ON m.user_id = u.id
            WHERE m.group_id = ?
            ORDER BY m.created_at ASC`,
            [groupId]
        );

        // Update last read to the latest message ID
        if (messages.length > 0) {
            const latestId = messages[messages.length - 1].id;
            await db.query(
                'UPDATE group_members SET last_read_id = ? WHERE group_id = ? AND user_id = ?',
                [latestId, groupId, userId]
            );
        }

        res.json(messages);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 7. Send Group Message
exports.sendGroupMessage = async (req, res) => {
    const { groupId, message, type } = req.body;
    const userId = req.user.id;

    try {
        const [memberCheck] = await db.query(
            'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        if (!memberCheck.length) return res.status(403).json({ message: 'Not a member' });

        let finalMessage = message;
        if (type === 'image' && message && message.startsWith('data:image')) {
            finalMessage = saveBase64Image(message, 'chats');
        }

        const [result] = await db.query(
            'INSERT INTO group_messages_v2 (group_id, user_id, message, type) VALUES (?, ?, ?, ?)',
            [groupId, userId, finalMessage, type || 'text']
        );
        const messageId = result.insertId;

        // Update sender's last_read_id so they don't see their own message as unread
        await db.query(
            'UPDATE group_members SET last_read_id = ? WHERE group_id = ? AND user_id = ?',
            [messageId, groupId, userId]
        );

        res.status(201).json({ status: 'success', messageId, message: finalMessage });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 8. Get Group Members
exports.getGroupMembers = async (req, res) => {
    const { groupId } = req.params;
    try {
        const [members] = await db.query(
            `SELECT u.id, u.name, u.username, u.profile_picture, gm.role, gm.joined_at
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            ORDER BY gm.role DESC, u.name ASC`,
            [groupId]
        );
        res.json(members);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 9. Update Group Info (Admin only)
exports.updateGroup = async (req, res) => {
    const { groupId } = req.params;
    const { name, description, image_url } = req.body;
    const userId = req.user.id;

    console.log(`[UPDATE GROUP] ID: ${groupId}, User: ${userId}`);

    try {
        // 1. Check if user is admin
        const [adminCheck] = await db.query(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );

        if (!adminCheck.length || adminCheck[0].role !== 'admin') {
            console.log(`[UPDATE GROUP] Access Denied for user ${userId}`);
            return res.status(403).json({ message: 'Only admins can update group info' });
        }

        // 2. Fetch current data to avoid nulling out missing fields
        const [current] = await db.query('SELECT name, description, image_url FROM groups_list WHERE id = ?', [groupId]);
        if (!current.length) return res.status(404).json({ message: 'Group not found' });

        const finalName = name || current[0].name;
        const finalDesc = description !== undefined ? description : current[0].description;
        
        let finalImage = image_url || current[0].image_url;
        if (image_url && image_url.startsWith('data:image')) {
            finalImage = saveBase64Image(image_url, 'groups');
        }

        // 3. Update with final values
        await db.query(
            'UPDATE groups_list SET name = ?, description = ?, image_url = ? WHERE id = ?',
            [finalName, finalDesc, finalImage, groupId]
        );

        console.log(`[UPDATE GROUP] Success for group ${groupId}`);
        res.json({ status: 'success', message: 'Group updated successfully' });
    } catch (err) {
        console.error(`[UPDATE GROUP] Error:`, err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};
