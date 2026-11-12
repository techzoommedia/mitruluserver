"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowController = exports.NowController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const now_model_1 = __importDefault(require("../models/now.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const SUPER_ADMIN_EMAIL = 'srikanthtelkalapally888@gmail.com';
function checkIsAdmin(user) {
    if (!user)
        return false;
    if (user.email && user.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase())
        return true;
    if (user.isAdmin)
        return true;
    if (user.role === 'admin')
        return true;
    return false;
}
const SEED_ARTICLES = [
    {
        title: 'ఇస్రో మరో సంచలనం: త్వరలో అంతరిక్షంలో భారత స్వదేశీ స్పేస్ స్టేషన్!',
        teluguTitle: 'ఇస్రో మరో సంచలనం: త్వరలో అంతరిక్షంలో భారత స్వదేశీ స్పేస్ స్టేషన్!',
        content: 'భారత అంతరిక్ష పరిశోధనా సంస్థ (ISRO) మరో భారీ ముందడుగు వేస్తోంది. భారతీయ అంతరిక్ష స్టేషన్ (BAS) మొదటి మాడ్యూల్‌ను 2028 నాటికి ప్రయోగించాలని లక్ష్యంగా పెట్టుకున్నట్లు ఛైర్మన్ వెల్లడించారు. గగన్‌యాన్ మిషన్ ప్రయోగాలు కూడా శరవేగంగా సాగుతున్నాయి. ప్రపంచ దేశాల్లో భారత్ అగ్రగామిగా నిలవడానికి ఈ ప్రాజెక్ట్ అత్యంత కీలకమని సైంటిస్టులు తెలిపారు.',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1080&auto=format&fit=crop&q=80',
        category: 'తాజా వార్తలు (Breaking)',
        source: 'మిత్రులు నౌ (Mitrulu Now)',
        status: 'approved',
    },
    {
        title: 'టాటా ఐపీఎల్ 2026: హైదరాబాద్ ఉప్పల్ స్టేడియంలో సన్‌రైజర్స్ తుపాను బ్యాటింగ్!',
        teluguTitle: 'టాటా ఐపీఎల్ 2026: హైదరాబాద్ ఉప్పల్ స్టేడియంలో సన్‌రైజర్స్ తుపాను బ్యాటింగ్!',
        content: 'ఉప్పల్ రాజీవ్ గాంధీ స్టేడియంలో సన్‌రైజర్స్ హైదరాబాద్ విధ్వంసకర ఇన్నింగ్స్ ఆడింది. కేవలం 20 ఓవర్లలోనే రికార్డు స్కోరు సాధించి అభిమానులను ఉర్రూతలూగించింది. కెప్టెన్ మరియు ఓపెనర్ల భాగస్వామ్యంతో పవర్ ప్లేలోనే 90 పైగా పరుగులు పిండుకున్నారు. ఆరెంజ్ ఆర్మీ ఫ్యాన్స్ సంబరాలు అంబరాన్నంటాయి.',
        imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1080&auto=format&fit=crop&q=80',
        category: 'క్రీడలు (Sports)',
        source: 'మిత్రులు స్పోర్ట్స్ డెస్క్',
        status: 'approved',
    },
    {
        title: 'టోలీవుడ్ బిగ్ అనౌన్స్‌మెంట్: గ్లోబల్ స్టార్ నయా పాన్-ఇండియా మూవీ టీజర్ రిలీజ్!',
        teluguTitle: 'టోలీవుడ్ బిగ్ అనౌన్స్‌మెంట్: గ్లోబల్ స్టార్ నయా పాన్-ఇండియా మూవీ టీజర్ రిలీజ్!',
        content: 'తెలుగు సినిమా మరోసారి ప్రపంచ స్థాయిలో రికార్డులు తిరగరాయడానికి సిద్ధమవుతోంది. అత్యున్నత సాంకేతిక విలువలతో, హాలీవుడ్ స్థాయి విజువల్ ఎఫెక్ట్స్‌తో రూపుదిద్దుకున్న భారీ యాక్షన్ ఎంటర్టైనర్ టీజర్ యూట్యూబ్‌లో 24 గంటల్లోనే రికార్డు వ్యూస్ సాధించింది. సంగీత దర్శకుడి బ్యాక్‌గ్రౌండ్ స్కోర్ సోషల్ మీడియాలో ట్రెండ్ అవుతోంది.',
        imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1080&auto=format&fit=crop&q=80',
        category: 'టాలీవుడ్ (Cinema)',
        source: 'మిత్రులు మూవీస్',
        status: 'approved',
    },
    {
        title: 'హైదరాబాద్ మెట్రో ఫేజ్-2 కు కేంద్ర కేబినెట్ ఆమోదం: కొత్త మార్గాల వివరాలు ఇవే!',
        teluguTitle: 'హైదరాబాద్ మెట్రో ఫేజ్-2 కు కేంద్ర కేబినెట్ ఆమోదం: కొత్త మార్గాల వివరాలు ఇవే!',
        content: 'హైదరాబాద్ నగర ప్రయాణికులకు శుభవార్త. శంషాబాద్ ఎయిర్‌పోర్ట్ కారిడార్‌తో పాటు పాతబస్తీ, హైటెక్ సిటీ అనుసంధాన మార్గాలకు నిధులు విడుదలయ్యాయి. మొత్తం 76 కిలోమీటర్ల మేర నూతన కారిడార్లు అందుబాటులోకి రానున్నాయి. దీనితో ట్రాఫిక్ సమస్యలు గణనీయంగా తగ్గిపోతాయని అధికారులు ప్రకటించారు.',
        imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1080&auto=format&fit=crop&q=80',
        category: 'తెలంగాణ & ఏపీ',
        source: 'మిత్రులు న్యూస్ నెట్‌వర్క్',
        status: 'approved',
    },
    {
        title: 'ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ రంగంలో తెలుగు భాషకు పట్టాభిషేకం: గూగుల్ & భారత్ AI సంచలనం!',
        teluguTitle: 'ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ రంగంలో తెలుగు భాషకు పట్టాభిషేకం: గూగుల్ & భారత్ AI సంచలనం!',
        content: 'ఇప్పుడు ఏఐ టూల్స్ అన్నీ అచ్చమైన తెలుగులో స్పష్టంగా సమాధానాలు ఇస్తున్నాయి. ప్రభుత్వ పథకాల వివరాలు, రైతులకు పంట సలహాలు, విద్యార్థులకు సిలబస్ అనువాదాలు నేరుగా గ్రామీణ తెలుగులోనే అందించే సరికొత్త వాయిస్ అసిస్టెంట్‌లు రూపుదిద్దుకున్నాయి. టెక్ ప్రపంచంలో తెలుగు ఖ్యాతి మరింత ఇనుమడించింది.',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80',
        category: 'టెక్నాలజీ (Tech)',
        source: 'మిత్రులు టెక్ డెస్క్',
        status: 'approved',
    },
];
class NowController {
    async getNowNews(req, res) {
        try {
            const pageParam = req.query.page;
            const limitParam = req.query.limit;
            const category = req.query.category || '';
            const statusParam = req.query.status || '';
            const currentUserId = req.userId;
            const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
            const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam, 10))) : 20;
            const skip = (page - 1) * limit;
            let isCurrentUserAdmin = false;
            let currentUserDoc = null;
            if (currentUserId && mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
                currentUserDoc = await user_model_1.default.findById(currentUserId)
                    .select('name teluguName handle avatar role isAdmin email')
                    .lean();
                if (currentUserDoc) {
                    isCurrentUserAdmin = checkIsAdmin(currentUserDoc);
                }
            }
            const query = {};
            if (category && category.toLowerCase() !== 'all') {
                query.category = category;
            }
            if (statusParam === 'pending') {
                if (isCurrentUserAdmin) {
                    query.status = 'pending';
                }
                else if (currentUserId && mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
                    query.status = 'pending';
                    query.author = new mongoose_1.default.Types.ObjectId(currentUserId);
                }
                else {
                    query.status = 'approved';
                }
            }
            else if (statusParam === 'all' && isCurrentUserAdmin) {
                // Show all to admin
            }
            else {
                query.$or = [{ status: 'approved' }, { status: { $exists: false } }];
            }
            // Check if auto-seed needed when database has 0 items
            const existingCount = await now_model_1.default.countDocuments();
            if (existingCount === 0) {
                // Also check if 'nownews' legacy collection has items
                const rawDb = mongoose_1.default.connection.db;
                let migrated = false;
                if (rawDb) {
                    try {
                        const legacyItems = await rawDb.collection('nownews').find().toArray();
                        if (legacyItems && legacyItems.length > 0) {
                            await now_model_1.default.insertMany(legacyItems);
                            migrated = true;
                        }
                    }
                    catch { }
                }
                if (!migrated) {
                    let authorId = currentUserDoc?._id;
                    if (!authorId) {
                        const adminUser = await user_model_1.default.findOne({
                            $or: [{ role: 'admin' }, { isAdmin: true }, { email: SUPER_ADMIN_EMAIL }],
                        })
                            .select('_id')
                            .lean();
                        authorId = adminUser?._id || (await user_model_1.default.findOne().select('_id').lean())?._id;
                    }
                    if (authorId) {
                        const docsToInsert = SEED_ARTICLES.map((article, idx) => ({
                            ...article,
                            author: authorId,
                            likes: [],
                            likesCount: 0,
                            comments: [],
                            commentsCount: 0,
                            sharesCount: 0,
                            viewsCount: 0,
                            createdAt: new Date(Date.now() - (idx + 1) * 1000 * 60 * 30),
                        }));
                        await now_model_1.default.insertMany(docsToInsert);
                    }
                }
            }
            const isFastLoad = limit <= 2 && page === 1;
            let news = [];
            let totalCount = 0;
            let pendingCount = 0;
            if (isFastLoad) {
                news = await now_model_1.default.find(query)
                    .populate('author', 'name teluguName handle avatar isVerified role isAdmin')
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean();
                totalCount = await now_model_1.default.countDocuments(query);
            }
            else {
                [news, totalCount, pendingCount] = await Promise.all([
                    now_model_1.default.find(query)
                        .populate('author', 'name teluguName handle avatar isVerified role isAdmin')
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    now_model_1.default.countDocuments(query),
                    isCurrentUserAdmin ? now_model_1.default.countDocuments({ status: 'pending' }) : Promise.resolve(0),
                ]);
            }
            const formatted = news.map((item) => {
                const isLiked = currentUserId
                    ? (item.likes || []).some((l) => l.toString() === currentUserId)
                    : false;
                const authorObj = item.author || {};
                return {
                    id: item._id.toString(),
                    title: item.title,
                    teluguTitle: item.teluguTitle || item.title,
                    content: item.content,
                    teluguContent: item.teluguContent || item.content,
                    imageUrl: item.imageUrl,
                    category: item.category || 'తాజా వార్తలు (Breaking)',
                    source: item.source || 'మిత్రులు నౌ (Mitrulu Now)',
                    status: item.status || 'approved',
                    author: {
                        id: authorObj._id?.toString() || 'editor',
                        name: authorObj.name || 'Mitrulu Editorial',
                        teluguName: authorObj.teluguName || authorObj.name || 'మిత్రులు వార్తలు',
                        handle: authorObj.handle || 'mitrulunow',
                        avatar: authorObj.avatar || '/mitrulu-logo.webp',
                        isVerified: Boolean(authorObj.isVerified),
                        role: authorObj.role || 'author',
                    },
                    likesCount: Array.isArray(item.likes) ? item.likes.length : item.likesCount || 0,
                    commentsCount: Array.isArray(item.comments) ? item.comments.length : item.commentsCount || 0,
                    sharesCount: item.sharesCount || 0,
                    viewsCount: item.viewsCount || 1,
                    isLiked,
                    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
                    comments: (item.comments || []).map((c) => ({
                        id: c._id?.toString(),
                        userName: c.userName || 'Mitrudu',
                        userTeluguName: c.userTeluguName,
                        userAvatar: c.userAvatar,
                        text: c.text,
                        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
                    })),
                };
            });
            const hasMore = skip + formatted.length < totalCount;
            res.json({
                success: true,
                news: formatted,
                total: totalCount,
                hasMore,
                pendingCount,
                isAdmin: isCurrentUserAdmin,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message || 'Failed to fetch now news' });
        }
    }
    async createNowNews(req, res) {
        try {
            const currentUserId = req.userId;
            if (!currentUserId || !mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
                res.status(401).json({ success: false, error: 'వార్తలు సృష్టించడానికి దయచేసి లాగిన్ అవ్వండి (Login required)' });
                return;
            }
            const userDoc = await user_model_1.default.findById(currentUserId)
                .select('name teluguName handle avatar role isAdmin email')
                .lean();
            if (!userDoc) {
                res.status(404).json({ success: false, error: 'వినియోగదారు కనుగొనబడలేదు (User not found)' });
                return;
            }
            const isAdmin = checkIsAdmin(userDoc);
            const { title, teluguTitle, content, teluguContent, imageUrl, category, source } = req.body;
            if (!title || typeof title !== 'string' || title.trim() === '') {
                res.status(400).json({ success: false, error: 'వార్త శీర్షిక (Title) తప్పనిసరి' });
                return;
            }
            if (!content || typeof content !== 'string' || content.trim() === '') {
                res.status(400).json({ success: false, error: 'వార్త వివరణ (Description/Content) తప్పనిసరి' });
                return;
            }
            if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
                res.status(400).json({ success: false, error: 'వార్త ఫోటో (Image) తప్పనిసరి' });
                return;
            }
            const initialStatus = isAdmin ? 'approved' : 'pending';
            const newNews = await now_model_1.default.create({
                title: title.trim(),
                teluguTitle: (teluguTitle || title).trim(),
                content: content.trim(),
                teluguContent: (teluguContent || content).trim(),
                imageUrl: imageUrl.trim(),
                category: category?.trim() || 'తాజా వార్తలు (Breaking)',
                source: source?.trim() || 'మిత్రులు నౌ (Mitrulu Now)',
                author: userDoc._id,
                status: initialStatus,
                likes: [],
                likesCount: 0,
                comments: [],
                commentsCount: 0,
                sharesCount: 0,
                viewsCount: 0,
            });
            const populated = await now_model_1.default.findById(newNews._id)
                .populate('author', 'name teluguName handle avatar isVerified role isAdmin')
                .lean();
            const authorObj = populated?.author || userDoc;
            const successMessage = isAdmin
                ? 'వార్త విజయవంతంగా ప్రచురించబడింది (News published directly)'
                : 'మీ వార్త విజయవంతంగా సమర్పించబడింది! అడ్మిన్ పరిశీలించి ఆమోదించిన వెంటనే లైవ్ అవుతుంది. (Submitted! Awaiting admin approval)';
            res.json({
                success: true,
                message: successMessage,
                status: initialStatus,
                newsItem: {
                    id: populated._id.toString(),
                    title: populated.title,
                    teluguTitle: populated.teluguTitle || populated.title,
                    content: populated.content,
                    teluguContent: populated.teluguContent || populated.content,
                    imageUrl: populated.imageUrl,
                    category: populated.category,
                    source: populated.source,
                    status: initialStatus,
                    author: {
                        id: authorObj._id?.toString() || userDoc._id.toString(),
                        name: authorObj.name || userDoc.name,
                        teluguName: authorObj.teluguName || userDoc.teluguName || authorObj.name,
                        handle: authorObj.handle || userDoc.handle,
                        avatar: authorObj.avatar || userDoc.avatar,
                        isVerified: Boolean(authorObj.isVerified),
                        role: authorObj.role || 'author',
                    },
                    likesCount: 0,
                    commentsCount: 0,
                    sharesCount: 0,
                    viewsCount: 0,
                    isLiked: false,
                    comments: [],
                    createdAt: populated.createdAt ? new Date(populated.createdAt).toISOString() : new Date().toISOString(),
                },
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message || 'వార్తను ప్రచురించడం విఫలమైంది' });
        }
    }
    async updateNowStatus(req, res) {
        try {
            const currentUserId = req.userId;
            if (!currentUserId || !mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
                res.status(401).json({ success: false, error: 'అనుమతి నిరాకరించబడింది (Authentication required)' });
                return;
            }
            const { id } = req.params;
            if (!id || !mongoose_1.default.Types.ObjectId.isValid(id)) {
                res.status(400).json({ success: false, error: 'చెల్లని న్యూస్ ఐడీ (Invalid News ID)' });
                return;
            }
            const userDoc = await user_model_1.default.findById(currentUserId)
                .select('name role isAdmin email')
                .lean();
            if (!checkIsAdmin(userDoc)) {
                res.status(403).json({ success: false, error: 'కేవలం అడ్మిన్‌కు మాత్రమే ఆమోదించే హక్కు ఉంది (Admin only)' });
                return;
            }
            const { status } = req.body;
            if (!['approved', 'rejected', 'pending'].includes(status)) {
                res.status(400).json({ success: false, error: 'సరైన స్టేటస్ పేర్కొనండి (Valid status: approved, rejected, pending)' });
                return;
            }
            const updated = await now_model_1.default.findByIdAndUpdate(id, { $set: { status } }, { new: true });
            if (!updated) {
                res.status(404).json({ success: false, error: 'న్యూస్ కనుగొనబడలేదు (News item not found)' });
                return;
            }
            const message = status === 'approved'
                ? 'వార్త ఆమోదించబడింది మరియు లైవ్ అయింది! (News approved and live)'
                : status === 'rejected'
                    ? 'వార్త తిరస్కరించబడింది (News rejected)'
                    : 'వార్త పెండింగ్‌కు మార్చబడింది (News status set to pending)';
            res.json({
                success: true,
                message,
                status: updated.status,
                id: updated._id.toString(),
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message || 'స్టేటస్ అప్‌డేట్ విఫలమైంది' });
        }
    }
    async seedNowNews(req, res) {
        try {
            const currentUserId = req.userId;
            let authorId = currentUserId && mongoose_1.default.Types.ObjectId.isValid(currentUserId) ? new mongoose_1.default.Types.ObjectId(currentUserId) : undefined;
            if (!authorId) {
                const adminUser = await user_model_1.default.findOne({
                    $or: [{ role: 'admin' }, { isAdmin: true }, { email: SUPER_ADMIN_EMAIL }],
                })
                    .select('_id')
                    .lean();
                authorId = adminUser?._id || (await user_model_1.default.findOne().select('_id').lean())?._id;
            }
            if (!authorId) {
                res.status(400).json({ success: false, error: 'No user available for authoring seed news' });
                return;
            }
            const docsToInsert = SEED_ARTICLES.map((article, idx) => ({
                ...article,
                author: authorId,
                likes: [],
                likesCount: 0,
                comments: [],
                commentsCount: 0,
                sharesCount: 0,
                viewsCount: 0,
                createdAt: new Date(Date.now() - (idx + 1) * 1000 * 60 * 30),
            }));
            await now_model_1.default.insertMany(docsToInsert);
            res.json({ success: true, count: docsToInsert.length });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
    async toggleLikeNow(req, res) {
        try {
            const currentUserId = req.userId;
            if (!currentUserId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const { id } = req.params;
            const item = await now_model_1.default.findById(id);
            if (!item) {
                res.status(404).json({ error: 'News item not found' });
                return;
            }
            const uObjId = new mongoose_1.default.Types.ObjectId(currentUserId);
            const isLiked = item.likes.some((l) => l.toString() === currentUserId);
            if (isLiked) {
                item.likes = item.likes.filter((l) => l.toString() !== currentUserId);
                item.likesCount = Math.max(0, (item.likesCount || 1) - 1);
            }
            else {
                item.likes.push(uObjId);
                item.likesCount = (item.likesCount || 0) + 1;
            }
            await item.save();
            res.json({ success: true, isLiked: !isLiked, likesCount: item.likesCount });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async addCommentNow(req, res) {
        try {
            const currentUserId = req.userId;
            if (!currentUserId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const { id } = req.params;
            const { text } = req.body;
            if (!text?.trim()) {
                res.status(400).json({ error: 'Text is required' });
                return;
            }
            const item = await now_model_1.default.findById(id);
            if (!item) {
                res.status(404).json({ error: 'News item not found' });
                return;
            }
            const user = await user_model_1.default.findById(currentUserId).lean();
            item.comments.push({
                user: new mongoose_1.default.Types.ObjectId(currentUserId),
                userName: user?.name || 'Mitrudu',
                userTeluguName: user?.teluguName || user?.name || 'మిత్రుడు',
                userHandle: user?.mitraId || user?.handle || '',
                userAvatar: user?.avatar || '',
                text: text.trim(),
                createdAt: new Date(),
            });
            item.commentsCount = (item.commentsCount || 0) + 1;
            await item.save();
            const added = item.comments[item.comments.length - 1];
            res.json({
                success: true,
                commentsCount: item.commentsCount,
                comment: {
                    id: added?._id?.toString(),
                    userName: added?.userName,
                    userTeluguName: added?.userTeluguName,
                    userAvatar: added?.userAvatar,
                    text: added?.text,
                    createdAt: added?.createdAt ? new Date(added.createdAt).toISOString() : new Date().toISOString(),
                },
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async shareNow(req, res) {
        try {
            const { id } = req.params;
            const updated = await now_model_1.default.findByIdAndUpdate(id, { $inc: { sharesCount: 1 } }, { new: true });
            res.json({ success: true, sharesCount: updated?.sharesCount || 1 });
        }
        catch {
            res.json({ success: true });
        }
    }
}
exports.NowController = NowController;
exports.nowController = new NowController();
exports.default = exports.nowController;
