const routes = {
    'home': {
        title: 'Главная',
        init: () => {
            document.getElementById('content').innerHTML = `<div id="feed" class="grid-container"></div>`;
            if (typeof showSongsView === 'function') showSongsView();
            setActiveNav('navHome');
        }
    },
    'albums': {
        title: 'Альбомы',
        init: () => {
            document.getElementById('content').innerHTML = `<div id="album-grid" class="album-grid"></div>`;
            if (typeof showAlbumsView === 'function') showAlbumsView();
            setActiveNav('navAlbums');
        }
    },
    'favorites': {
        title: 'Избранное',
        init: () => {
            document.getElementById('content').innerHTML = `<div id="feed" class="grid-container"></div>`;
            if (typeof showSongsView === 'function') showSongsView();
            // Override sort to favorites
            currentSort = 'favorites';
            if (typeof refreshAll === 'function') refreshAll();
            setActiveNav('navFavorites');
        }
    }
};

function navigate(page) {
    const content = document.getElementById('content');
    if (!routes[page]) return;

    content.style.opacity = 0;
    setTimeout(() => {
        routes[page].init();
        content.style.opacity = 1;
    }, 150);
}

function setActiveNav(id) {
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(id);
    if (btn) btn.classList.add('active');
}
