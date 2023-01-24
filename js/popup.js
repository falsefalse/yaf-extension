/*global chrome */

// Render services links for domain/IP and display them in popup

import Templates from './templates.min.js'
import { YAF, getDomain, isLocal } from './service.min.js'

function get(template) {
    return Templates[template];
}

async function renderPopup (tab) {
    let domain = getDomain(tab.url)
    let data = await YAF.storage.get(domain)

    var toolbar = document.querySelector('.toolbar');
    var result = document.querySelector('.result');

    // toolbar
    toolbar.innerHTML = get('toolbar.ejs')({
        geo: data.geo,
        trueLocal: isLocal(domain)
    });

    var mark = toolbar.querySelector('.toolbar-marklocal'),
        reload = toolbar.querySelector('.toolbar-reload');

    mark && mark.addEventListener('click', async function() {
        if (data.geo && data.geo.isLocal) {
            delete data.geo.isLocal;
        } else {
            data.geo = data.geo || {};
            data.geo.isLocal = true;
        }

        YAF.storage.set(domain, data);
        await YAF.setFlag(tab);

        window.location.reload();
    });
    reload && reload.addEventListener('click', async function() {
        if (data.geo && !data.geo.isLocal) {
            toolbar.innerHTML = get('toolbar.ejs')({
                geo: data.geo,
                trueLocal: isLocal(domain),
                loading: true
            });
        }

        await YAF.setFlag(tab, true)
        window.location.reload(true);
    });

    // data
    if (data.error) {
        result.innerHTML = get('not_found.ejs')({
            domain: domain,
            error: data.error
        });
    }
    else if (data.geo.isLocal) {
        result.innerHTML = get('local.ejs')({
            domain: domain,
            geo: data.geo
        });
    }
    else {
        result.innerHTML = get('regular.ejs')({
            domain: domain,
            geo: data.geo
        });
    }
}

window.addEventListener('DOMContentLoaded', async function() {
  let [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
  })

  await renderPopup(currentTab)
})
