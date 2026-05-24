let state = { projects: {}, activeProjectId: null, customColors: ['#bf616a', '#ebcb8b', '#a3be8c'], selectedNodeId: null };

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
        // Hapus duplikat dari bug sebelumnya dan set default
        if (state.customColors) {
            state.customColors = [...new Set(state.customColors)];
        } else {
            state.customColors = ['default', '#bf616a', '#ebcb8b', '#a3be8c'];
        }
        // Pastikan warna 'default' selalu ada di paling awal
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

function renderTree() {
    const activeProject = state.projects[state.activeProjectId];
    if (!activeProject) return;
    updateNodeNumbering(activeProject.tree);
    treeContainer.innerHTML = `<ul>${generateNodeHTML(activeProject.tree)}</ul>`;
    updateProjectSelect();
}

window.selectNode = (e, id) => {
    state.selectedNodeId = id;
    renderTree();
    updateSidebarActions();
};

// Klik di luar node untuk deselect
canvasWrapper.addEventListener('click', (e) => {
    if (!e.target.closest('.node-card')) {
        state.selectedNodeId = null;
        renderTree();
        updateSidebarActions();
    }
});

function updateSidebarActions() {
    const palette = document.getElementById('color-palette');
    palette.innerHTML = '';
    
    if (!state.selectedNodeId) {
        palette.classList.add('disabled');
        palette.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Pilih node pada diagram</span>';
        return;
    }
    
    palette.classList.remove('disabled');

    // Render warna yang ada
    state.customColors.forEach(color => {
        const wrapper = document.createElement('div');
        wrapper.className = 'swatch-wrapper';

        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        
        if (color === 'default') {
            swatch.classList.add('default-swatch');
            swatch.title = "Warna Tema Default";
        } else {
            swatch.style.backgroundColor = color;
            swatch.title = color;
        }
        
        swatch.onclick = () => changeNodeColor(state.selectedNodeId, color);
        wrapper.appendChild(swatch);

        // Tambah tombol delete jika bukan warna default
        if (color !== 'default') {
            const delBtn = document.createElement('button');
            delBtn.className = 'swatch-delete';
            delBtn.innerHTML = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                state.customColors = state.customColors.filter(c => c !== color);
                updateSidebarActions();
                saveData();
            };
            wrapper.appendChild(delBtn);
        }

        palette.appendChild(wrapper);
    });

    // Render tombol +
    const addBtn = document.createElement('div');
    addBtn.className = 'color-swatch add-btn';
    addBtn.innerText = '+';
    addBtn.onclick = () => document.getElementById('hidden-color-picker').click();
    palette.appendChild(addBtn);
}

// Event saat warna baru dipilih via color picker
document.getElementById('hidden-color-picker').addEventListener('change', (e) => {
    const newColor = e.target.value;
    if (!state.customColors.includes(newColor)) {
        state.customColors.push(newColor); // Tambah ke deretan
    }
    changeNodeColor(state.selectedNodeId, newColor);
    updateSidebarActions();
    saveData();
});

// Update renderTree() agar mengupdate sidebar saat render
const originalRenderTree = renderTree;
renderTree = () => {
    originalRenderTree();
    updateSidebarActions();
};

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

window.changeNodeColor = (id, color) => {
    const result = findNodeAndParent(id);
    if (result) {
        if (color === 'default') {
            delete result.node.borderColor; // Hapus warna agar kembali ke warna default UI
        } else {
            result.node.borderColor = color;
        }
        saveData(); 
        renderTree();
    }
};

// --- POSITION / HIERARCHY MOVEMENT ---

window.moveNodeUp = (id) => {
    const result = findNodeAndParent(id);
    if (result && result.parent && result.index > 0) {
        const parentChildren = result.parent.children;
        // Swap with sibling above
        [parentChildren[result.index], parentChildren[result.index - 1]] = [parentChildren[result.index - 1], parentChildren[result.index]];
        saveData(); renderTree();
    }
};

window.moveNodeDown = (id) => {
    const result = findNodeAndParent(id);
    if (result && result.parent) {
        const parentChildren = result.parent.children;
        if (result.index < parentChildren.length - 1) {
            // Swap with sibling below
            [parentChildren[result.index], parentChildren[result.index + 1]] = [parentChildren[result.index + 1], parentChildren[result.index]];
            saveData(); renderTree();
        }
    }
};

window.indentNode = (id) => {
    const result = findNodeAndParent(id);
    // Cannot indent root or the first child
    if (result && result.parent && result.index > 0) {
        const parentChildren = result.parent.children;
        const previousSibling = parentChildren[result.index - 1];
        const nodeToMove = result.node;

        // Remove from current parent
        parentChildren.splice(result.index, 1);
        
        // Add as child to previous sibling
        if (!previousSibling.children) previousSibling.children = [];
        previousSibling.children.push(nodeToMove);
        previousSibling.collapsed = false; // Auto expand to show new child

        saveData(); renderTree();
    }
};

window.outdentNode = (id) => {
    const result = findNodeAndParent(id);
    // Find parent of parent (grandparent)
    if (result && result.parent && result.parent.number !== undefined) {
        const grandparentResult = findNodeAndParent(result.parent.id);
        
        if (grandparentResult) {
            const nodeToMove = result.node;
            const currentParentChildren = result.parent.children;
            
            // Remove from current parent
            currentParentChildren.splice(result.index, 1);
            
            // Add as sibling *after* the former parent in the grandparent's children array
            constFormerParentIndex = grandparentResult.index;
            grandparentResult.parent.children.splice(constFormerParentIndex + 1, 0, nodeToMove);
            
            saveData(); renderTree();
        }
    }
};

// --- PAN AND ZOOM ---
let scale = 1; let isPanning = false; let startPoint = { x: 0, y: 0 }; let currentTranslate = { x: 0, y: 0 };

function applyTransform() { treeContainer.style.transform = `translate(${currentTranslate.x}px, ${currentTranslate.y}px) scale(${scale})`; }

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
    scale += e.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.min(Math.max(0.3, scale), 3);
    applyTransform();
}, { passive: false });

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

document.getElementById('btn-new-project').addEventListener('click', () => {
    const name = prompt('Project Name:', 'New Project');
    if (name) {
        const newProj = createEmptyProject(name);
        state.projects[newProj.id] = newProj; state.activeProjectId = newProj.id;
        scale = 1; currentTranslate = {x: 0, y: 0}; applyTransform();
        saveData(); renderTree();
    }
});

document.getElementById('btn-rename-project').addEventListener('click', () => {
    const active = state.projects[state.activeProjectId];
    const name = prompt('Rename Project:', active.name);
    if (name) { active.name = name; saveData(); updateProjectSelect(); }
});

document.getElementById('btn-delete-project').addEventListener('click', () => {
    if (Object.keys(state.projects).length <= 1) return alert('Cannot delete the last project.');
    if (confirm('Delete this project?')) {
        delete state.projects[state.activeProjectId];
        state.activeProjectId = Object.keys(state.projects)[0];
        scale = 1; currentTranslate = {x: 0, y: 0}; applyTransform();
        saveData(); renderTree();
    }
});

// --- TEXT TO DIAGRAM & EXPORT AS TEXT ---
document.getElementById('btn-generate-text').addEventListener('click', () => {
    const text = document.getElementById('text-import').value;
    if (!text.trim()) return;

    let newTree = { id: 'node_' + Date.now(), text: 'Root', children: [] };
    let nodeMap = {};

    text.split('\n').filter(l => l.trim() !== '').forEach(line => {
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
    updateNodeNumbering(activeTree); // Ensure numbering is fresh
    const textData = extractTextFromTree(activeTree);
    navigator.clipboard.writeText(textData.trim()).then(() => alert("Tree exported as text and copied to clipboard!"));
});

// --- EXPORT TO PNG (html2canvas with Offline Check) ---
document.getElementById('btn-export-png').addEventListener('click', () => {
    if (typeof html2canvas === 'undefined') return alert("Gagal memuat library. Pastikan ada koneksi internet untuk export PNG.");
    const treeElement = document.getElementById('tree-container');
    const oldScale = scale; const oldTranslate = currentTranslate;
    
    // Reset for screenshot
    scale = 1; currentTranslate = {x: 0, y: 0}; applyTransform();

    // Re-ensure numbers are updated
    updateNodeNumbering(state.projects[state.activeProjectId].tree);

    const bgColor = isLightMode ? '#f5f7fa' : '#121212';
    html2canvas(treeElement, {
        backgroundColor: bgColor,
        scale: 2, 
        ignoreElements: (element) => 
            element.classList.contains('node-controls') || 
            element.classList.contains('position-controls') || 
            element.classList.contains('color-picker-container') ||
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

// --- RESET SEMUA WARNA BORDER ---
function resetColorsRecursively(node) {
    if (node.borderColor) {
        delete node.borderColor;
    }
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => resetColorsRecursively(child));
    }
}

document.getElementById('btn-reset-colors').addEventListener('click', () => {
    if (confirm('Reset semua warna border ke default?')) {
        const activeTree = state.projects[state.activeProjectId].tree;
        resetColorsRecursively(activeTree);
        saveData(); 
        renderTree();
    }
});

window.onload = () => { loadData(); renderTree(); };