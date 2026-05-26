let state = { projects: {}, activeProjectId: null, customColors: ['#bf616a', '#ebcb8b', '#a3be8c'], selectedNodeId: null };

// --- CUSTOM UI DIALOG ---
const CustomUI = {
    show: (type, title, message, defaultValue = '') => {
        return new Promise((resolve) => {
            const modal = document.getElementById('ui-modal');
            const input = document.getElementById('ui-modal-input');
            const btnCancel = document.getElementById('ui-modal-cancel');
            const btnConfirm = document.getElementById('ui-modal-confirm');

            document.getElementById('ui-modal-title').innerText = title;
            document.getElementById('ui-modal-message').innerText = message;
            
            input.classList.add('hidden');
            btnCancel.classList.add('hidden');
            
            if (type === 'prompt') {
                input.classList.remove('hidden');
                input.value = defaultValue;
            }
            if (type === 'prompt' || type === 'confirm') {
                btnCancel.classList.remove('hidden');
            }

            modal.classList.remove('hidden');
            if (type === 'prompt') input.focus();

            const cleanup = () => {
                modal.classList.add('hidden');
                btnConfirm.onclick = null;
                btnCancel.onclick = null;
            };

            btnConfirm.onclick = () => {
                cleanup();
                resolve(type === 'prompt' ? input.value : true);
            };

            btnCancel.onclick = () => {
                cleanup();
                resolve(type === 'prompt' ? null : false);
            };
        });
    },
    alert: (title, message) => CustomUI.show('alert', title, message),
    confirm: (title, message) => CustomUI.show('confirm', title, message),
    prompt: (title, message, defaultVal) => CustomUI.show('prompt', title, message, defaultVal)
};

function createEmptyProject(name) {
    return {
        id: 'proj_' + Date.now(),
        name: name,
        tree: { id: 'node_' + Date.now(), text: 'Vision / Goal', collapsed: false, children: [] }
    };
}

function loadData() {
    const data = localStorage.getItem('wbs_planner_data');
    if (data) {
        state = JSON.parse(data);
        if (state.customColors) {
            state.customColors = [...new Set(state.customColors)];
        } else {
            state.customColors = ['default', '#bf616a', '#ebcb8b', '#a3be8c'];
        }
        if (!state.customColors.includes('default')) {
            state.customColors.unshift('default');
        }
        state.selectedNodeId = null;
    } else {
        const defaultProj = createEmptyProject('My First Project');
        state.projects[defaultProj.id] = defaultProj;
        state.activeProjectId = defaultProj.id;
        state.customColors = ['default', '#bf616a', '#ebcb8b', '#a3be8c'];
    }
}

function saveData() {
    localStorage.setItem('wbs_planner_data', JSON.stringify(state));
    showSaveIndicator();
}

function showSaveIndicator() {
    const ind = document.getElementById('save-indicator');
    ind.classList.add('show');
    setTimeout(() => ind.classList.remove('show'), 2000);
}

// --- UI CONTROLS (THEME & SIDEBAR) ---
const themeBtn = document.getElementById('btn-theme');
let isLightMode = localStorage.getItem('wbs_theme') === 'light';
if (isLightMode) document.documentElement.setAttribute('data-theme', 'light');

themeBtn.addEventListener('click', () => {
    isLightMode = !isLightMode;
    if (isLightMode) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('wbs_theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('wbs_theme', 'dark');
    }
});

const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');
const closeBtn = document.getElementById('close-sidebar');

closeBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    toggleBtn.classList.remove('hidden');
});

toggleBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    toggleBtn.classList.add('hidden');
});

// --- RENDER LOGIC ---
const treeContainer = document.getElementById('tree-container');
const projectSelect = document.getElementById('project-select');
const canvasWrapper = document.getElementById('canvas-wrapper');

function updateNodeNumbering(node, prefix = '1') {
    node.number = prefix;
    if (node.children) {
        node.children.forEach((child, index) => {
            updateNodeNumbering(child, `${prefix}.${index + 1}`);
        });
    }
}

function generateNodeHTML(node) {
    const isRoot = node.number === '1';
    const borderStyle = node.borderColor ? `style="border-color: ${node.borderColor}; border-width: 2px;"` : '';
    const isSelected = state.selectedNodeId === node.id ? 'selected' : '';

    let html = `
    <li>
        <div class="node-card ${isSelected}" data-id="${node.id}" ${borderStyle} onclick="selectNode(event, '${node.id}')">
            ${!isRoot && node.children && node.children.length > 0 ? `<button class="btn-icon collapse" onclick="event.stopPropagation(); toggleCollapse('${node.id}')">${node.collapsed ? '↓' : '↑'}</button>` : ''}
            
            ${!isRoot ? `
            <div class="position-controls">
                <button class="btn-icon" onclick="event.stopPropagation(); moveNodeUp('${node.id}')" title="Move Up">↑</button>
                <button class="btn-icon" onclick="event.stopPropagation(); indentNode('${node.id}')" title="Indent">→</button>
                <button class="btn-icon" onclick="event.stopPropagation(); outdentNode('${node.id}')" title="Outdent">←</button>
                <button class="btn-icon" onclick="event.stopPropagation(); moveNodeDown('${node.id}')" title="Move Down">↓</button>
            </div>
            ` : ''}

            <div class="node-number">${node.number}</div>
            <div class="node-text" contenteditable="true" onclick="event.stopPropagation(); selectNode(event, '${node.id}')" onblur="updateNodeText('${node.id}', this.innerText)">${node.text}</div>
            
            <div class="node-controls">
                <button class="btn-icon" onclick="event.stopPropagation(); addChild('${node.id}')" title="Add Child">+</button>
                ${!isRoot ? `<button class="btn-icon delete" onclick="event.stopPropagation(); deleteNode('${node.id}')" title="Delete Node">-</button>` : ''}
            </div>
        </div>`;
    if (node.children && node.children.length > 0 && !node.collapsed) {
        html += `<ul>${node.children.map(child => generateNodeHTML(child)).join('')}</ul>`;
    }
    html += `</li>`;
    return html;
}

let originalRenderTree = function() {
    const activeProject = state.projects[state.activeProjectId];
    if (!activeProject) return;
    updateNodeNumbering(activeProject.tree);
    treeContainer.innerHTML = `<ul>${generateNodeHTML(activeProject.tree)}</ul>`;
    updateProjectSelect();
};

function renderTree() {
    originalRenderTree();
    updateSidebarActions();
}

// --- NODE OPERATIONS ---
function findNodeAndParent(id, currentNode = state.projects[state.activeProjectId].tree, parent = null, index = 0) {
    if (currentNode.id === id) return { node: currentNode, parent, index };
    if (currentNode.children) {
        for (let i = 0; i < currentNode.children.length; i++) {
            const result = findNodeAndParent(id, currentNode.children[i], currentNode, i);
            if (result) return result;
        }
    }
    return null;
}

window.addChild = (parentId) => {
    const result = findNodeAndParent(parentId);
    if (result) {
        if(!result.node.children) result.node.children = [];
        result.node.children.push({ id: 'node_' + Date.now(), text: 'New Task', collapsed: false, children: [] });
        result.node.collapsed = false;
        saveData(); renderTree();
    }
};

window.deleteNode = (id) => {
    const result = findNodeAndParent(id);
    if (result && result.parent) {
        result.parent.children.splice(result.index, 1);
        saveData(); renderTree();
    }
};

window.updateNodeText = (id, newText) => {
    const result = findNodeAndParent(id);
    if (result && result.node.text !== newText) {
        result.node.text = newText.trim() === '' ? 'Empty' : newText.trim();
        saveData();
    }
};

window.toggleCollapse = (id) => {
    const result = findNodeAndParent(id);
    if (result) {
        result.node.collapsed = !result.node.collapsed;
        saveData(); renderTree();
    }
};

// --- POSITION / HIERARCHY MOVEMENT ---
window.moveNodeUp = (id) => {
    const result = findNodeAndParent(id);
    if (result && result.parent && result.index > 0) {
        const parentChildren = result.parent.children;
        [parentChildren[result.index], parentChildren[result.index - 1]] = [parentChildren[result.index - 1], parentChildren[result.index]];
        saveData(); renderTree();
    }
};

window.moveNodeDown = (id) => {
    const result = findNodeAndParent(id);
    if (result && result.parent) {
        const parentChildren = result.parent.children;
        if (result.index < parentChildren.length - 1) {
            [parentChildren[result.index], parentChildren[result.index + 1]] = [parentChildren[result.index + 1], parentChildren[result.index]];
            saveData(); renderTree();
        }
    }
};

window.indentNode = (id) => {
    const result = findNodeAndParent(id);
    if (result && result.parent && result.index > 0) {
        const parentChildren = result.parent.children;
        const previousSibling = parentChildren[result.index - 1];
        const nodeToMove = result.node;

        parentChildren.splice(result.index, 1);
        if (!previousSibling.children) previousSibling.children = [];
        previousSibling.children.push(nodeToMove);
        previousSibling.collapsed = false; 

        saveData(); renderTree();
    }
};

window.outdentNode = (id) => {
    const result = findNodeAndParent(id);
    if (result && result.parent && result.parent.number !== undefined) {
        const grandparentResult = findNodeAndParent(result.parent.id);
        if (grandparentResult) {
            const nodeToMove = result.node;
            const currentParentChildren = result.parent.children;
            
            currentParentChildren.splice(result.index, 1);
            const constFormerParentIndex = grandparentResult.index;
            grandparentResult.parent.children.splice(constFormerParentIndex + 1, 0, nodeToMove);
            
            saveData(); renderTree();
        }
    }
};

// --- PAN AND ZOOM (MOUSE & TOUCH) ---
let scale = 1; let isPanning = false; let startPoint = { x: 0, y: 0 }; let currentTranslate = { x: 0, y: 0 };
let initialPinchDistance = null;

function applyTransform() { treeContainer.style.transform = `translate(${currentTranslate.x}px, ${currentTranslate.y}px) scale(${scale})`; }

// MOUSE EVENTS
canvasWrapper.addEventListener('mousedown', (e) => {
    if (e.target.closest('.node-card')) return;
    isPanning = true; startPoint = { x: e.clientX - currentTranslate.x, y: e.clientY - currentTranslate.y };
});
window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    currentTranslate = { x: e.clientX - startPoint.x, y: e.clientY - startPoint.y };
    applyTransform();
});
window.addEventListener('mouseup', () => { isPanning = false; });
canvasWrapper.addEventListener('mouseleave', () => { isPanning = false; });
canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const oldScale = scale;
    scale += e.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.min(Math.max(0.3, scale), 3);

    // Dapatkan posisi kursor relatif terhadap area canvas
    const rect = canvasWrapper.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Geser koordinat translate agar posisi di bawah kursor tetap diam
    currentTranslate.x = mouseX - ((mouseX - currentTranslate.x) * (scale / oldScale));
    currentTranslate.y = mouseY - ((mouseY - currentTranslate.y) * (scale / oldScale));

    applyTransform();
}, { passive: false });

// TOUCH EVENTS (MOBILE)
canvasWrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        if (e.target.closest('.node-card')) return;
        isPanning = true;
        startPoint = { x: e.touches[0].clientX - currentTranslate.x, y: e.touches[0].clientY - currentTranslate.y };
    } else if (e.touches.length === 2) {
        isPanning = false;
        initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
}, { passive: false });

canvasWrapper.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isPanning) {
        currentTranslate = { x: e.touches[0].clientX - startPoint.x, y: e.touches[0].clientY - startPoint.y };
        applyTransform();
    } else if (e.touches.length === 2 && initialPinchDistance) {
        e.preventDefault(); 
        const currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        
        // Rasio pergerakan jari (jauh lebih halus dari angka fix)
        const pinchRatio = currentDistance / initialPinchDistance;
        const oldScale = scale;
        
        // Kalikan scale lama dengan rasio jari
        scale = Math.min(Math.max(0.3, oldScale * pinchRatio), 3);
        
        // Cari titik tengah antara 2 jari
        const rect = canvasWrapper.getBoundingClientRect();
        const pinchX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const pinchY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

        // Geser koordinat agar zoom fokus ke titik tengah jari
        currentTranslate.x = pinchX - ((pinchX - currentTranslate.x) * (scale / oldScale));
        currentTranslate.y = pinchY - ((pinchY - currentTranslate.y) * (scale / oldScale));

        initialPinchDistance = currentDistance; 
        applyTransform();
    }
}, { passive: false });

canvasWrapper.addEventListener('touchend', () => { isPanning = false; initialPinchDistance = null; });

// --- PROJECT MANAGEMENT ---
function updateProjectSelect() {
    projectSelect.innerHTML = '';
    for (const key in state.projects) {
        const opt = document.createElement('option');
        opt.value = key; opt.textContent = state.projects[key].name;
        if (key === state.activeProjectId) opt.selected = true;
        projectSelect.appendChild(opt);
    }
}

projectSelect.addEventListener('change', (e) => {
    state.activeProjectId = e.target.value;
    scale = 1; currentTranslate = {x: 0, y: 0}; applyTransform();
    saveData(); renderTree();
});

document.getElementById('btn-new-project').addEventListener('click', async () => {
    const name = await CustomUI.prompt('New Project', 'Enter project name:', 'New Project');
    if (name && name.trim()) {
        const newProj = createEmptyProject(name);
        state.projects[newProj.id] = newProj; state.activeProjectId = newProj.id;
        scale = 1; currentTranslate = {x: 0, y: 0}; applyTransform();
        saveData(); renderTree();
    }
});

document.getElementById('btn-rename-project').addEventListener('click', async () => {
    const active = state.projects[state.activeProjectId];
    const name = await CustomUI.prompt('Rename Project', 'Enter new project name:', active.name);
    
    if (name !== null && name.trim() !== '') { 
        active.name = name.trim(); 
        saveData(); 
        updateProjectSelect(); 
    }
});

document.getElementById('btn-delete-project').addEventListener('click', async () => {
    if (Object.keys(state.projects).length <= 1) {
        return CustomUI.alert('Oops!', 'Cannot delete the last project.');
    }
    const ok = await CustomUI.confirm('Delete Project', 'Are you sure you want to delete this project?');
    if (ok) {
        delete state.projects[state.activeProjectId];
        state.activeProjectId = Object.keys(state.projects)[0];
        scale = 1; currentTranslate = {x: 0, y: 0}; applyTransform();
        saveData(); renderTree();
    }
});

// --- NODE SELECTION & COLOR PALETTE ---
window.selectNode = (e, id) => {
    state.selectedNodeId = id;
    renderTree();
};

canvasWrapper.addEventListener('click', (e) => {
    if (!e.target.closest('.node-card')) {
        state.selectedNodeId = null;
        renderTree();
    }
});

function updateSidebarActions() {
    const palette = document.getElementById('color-palette');
    palette.innerHTML = '';
    
    if (!state.selectedNodeId) {
        palette.classList.add('disabled');
        palette.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Select a node on the diagram</span>';
        return;
    }
    
    palette.classList.remove('disabled');

    // Cek warna node yang sedang dipilih
    const activeNodeData = findNodeAndParent(state.selectedNodeId);
    const currentNodeColor = (activeNodeData && activeNodeData.node.borderColor) ? activeNodeData.node.borderColor : 'default';

    state.customColors.forEach(color => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swatch-wrapper';

        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        
        if (color === 'default') {
            swatch.classList.add('default-swatch');
            swatch.title = "Default Theme Color";
        } else {
            swatch.style.backgroundColor = color;
            swatch.title = color;
        }

        // Beri highlight jika ini adalah warna yang sedang dipakai oleh node
        if (color === currentNodeColor) {
            swatch.classList.add('active-color');
        }
        
        swatch.onclick = () => changeNodeColor(state.selectedNodeId, color);
        wrapper.appendChild(swatch);

        if (color !== 'default') {
            const delBtn = document.createElement('button');
            delBtn.className = 'swatch-delete';
            delBtn.innerHTML = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                state.customColors = state.customColors.filter(c => c !== color);
                
                // Jika warna yang dihapus sedang dipakai, reset node ke default
                if (color === currentNodeColor) {
                    changeNodeColor(state.selectedNodeId, 'default');
                } else {
                    updateSidebarActions();
                    saveData();
                }
            };
            wrapper.appendChild(delBtn);
        }

        palette.appendChild(wrapper);
    });

    const addBtn = document.createElement('div');
    addBtn.className = 'color-swatch add-btn';
    addBtn.innerText = '+';
    addBtn.onclick = () => document.getElementById('hidden-color-picker').click();
    palette.appendChild(addBtn);
}

document.getElementById('hidden-color-picker').addEventListener('change', (e) => {
    const newColor = e.target.value;
    if (!state.customColors.includes(newColor)) {
        state.customColors.push(newColor);
    }
    changeNodeColor(state.selectedNodeId, newColor);
    updateSidebarActions();
    saveData();
});

window.changeNodeColor = (id, color) => {
    const result = findNodeAndParent(id);
    if (result) {
        if (color === 'default') {
            delete result.node.borderColor; 
        } else {
            result.node.borderColor = color;
        }
        saveData(); 
        renderTree();
    }
};

function resetColorsRecursively(node) {
    if (node.borderColor) {
        delete node.borderColor;
    }
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => resetColorsRecursively(child));
    }
}

document.getElementById('btn-reset-colors').addEventListener('click', async () => {
    const ok = await CustomUI.confirm('Reset Colors', 'Reset all node borders to default?');
    if (ok) {
        const activeTree = state.projects[state.activeProjectId].tree;
        resetColorsRecursively(activeTree); 
        const essentialColors = ['default', '#bf616a', '#ebcb8b', '#a3be8c'];
        const userColors = state.customColors.filter(c => !essentialColors.includes(c));
        state.customColors = [...essentialColors, ...userColors];
        saveData(); renderTree();
    }
});

// --- TEXT TO DIAGRAM & EXPORT AS TEXT ---
document.getElementById('btn-generate-text').addEventListener('click', () => {
    const text = document.getElementById('text-import').value;
    if (!text.trim()) return CustomUI.alert('Empty Input', 'Please paste your text first.');

    const lines = text.split('\n').filter(l => l.trim() !== '');
    let isValidFormat = false;

    lines.forEach(line => {
        if (line.trim().match(/^([\d.]+)\s+(.*)$/)) isValidFormat = true;
    });

    if (!isValidFormat) {
        return CustomUI.alert('Invalid Format', 'Format text tidak sesuai.\nGunakan penomoran, contoh:\n1 Vision\n1.1 Goal A');
    }

    let newTree = { id: 'node_' + Date.now(), text: 'Root', children: [] };
    let nodeMap = {};

    lines.forEach(line => {
        const match = line.trim().match(/^([\d.]+)\s+(.*)$/);
        if (match) {
            let number = match[1];
            if (number.endsWith('.')) number = number.slice(0, -1);
            
            const newNode = { id: 'node_' + Math.random().toString(36).substr(2, 9), text: match[2], children: [] };
            nodeMap[number] = newNode;

            if (number === '1' || !number.includes('.')) {
                if(number === '1') newTree = newNode;
                else newTree.children.push(newNode);
            } else {
                const parts = number.split('.'); parts.pop();
                const parentNum = parts.join('.');
                if (nodeMap[parentNum]) nodeMap[parentNum].children.push(newNode);
                else newTree.children.push(newNode);
            }
        }
    });
    state.projects[state.activeProjectId].tree = newTree;
    document.getElementById('text-import').value = '';
    saveData(); renderTree();
});

function extractTextFromTree(node) {
    let result = `${node.number} ${node.text}\n`;
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => { result += extractTextFromTree(child); });
    }
    return result;
}

document.getElementById('btn-export-text').addEventListener('click', () => {
    const activeTree = state.projects[state.activeProjectId].tree;
    updateNodeNumbering(activeTree); 
    const textData = extractTextFromTree(activeTree);
    navigator.clipboard.writeText(textData.trim()).then(() => CustomUI.alert('Success', "Tree exported as text and copied to clipboard!"));
});

// --- EXPORT TO PNG (html2canvas) ---
document.getElementById('btn-export-png').addEventListener('click', () => {
    if (typeof html2canvas === 'undefined') return CustomUI.alert('Offline', "Failed to load library. Ensure you have an internet connection to export PNG.");
    const treeElement = document.getElementById('tree-container');
    const oldScale = scale; const oldTranslate = currentTranslate;
    
    // Reset for screenshot
    scale = 1; currentTranslate = {x: 0, y: 0}; applyTransform();
    updateNodeNumbering(state.projects[state.activeProjectId].tree);

    const bgColor = isLightMode ? '#f5f7fa' : '#121212';
    html2canvas(treeElement, {
        backgroundColor: bgColor,
        scale: 2, 
        ignoreElements: (element) => 
            element.classList.contains('node-controls') || 
            element.classList.contains('position-controls') || 
            element.classList.contains('collapse')
    }).then(canvas => {
        const link = document.createElement('a');
        const projectName = state.projects[state.activeProjectId].name.replace(/\s+/g, '_');
        link.download = `WBS_${projectName}.png`; link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Restore
        scale = oldScale; currentTranslate = oldTranslate; applyTransform();
    });
});

// --- ABOUT MODAL ---
const aboutModal = document.getElementById('about-modal');
const btnAbout = document.getElementById('btn-about');
const closeModal = document.getElementById('close-modal');

btnAbout.addEventListener('click', () => aboutModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => aboutModal.classList.add('hidden'));

// Tutup modal jika user klik area gelap di luar kotak modal
aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
});

window.onload = () => { loadData(); renderTree(); };