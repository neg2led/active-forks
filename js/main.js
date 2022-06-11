const github_token = '';

var request_headers = new Headers({});

window.addEventListener('load', () => {
    initDT(); // Initialize the DatatTable and window.columnNames variables
    addDarkmodeWidget();

    const repo = getRepoFromUrl();

    if (repo) {
        document.getElementById('q').value = repo;
        // fetchData();
    }
});

document.getElementById('form').addEventListener('submit', (e) => {
    e.preventDefault();
    fetchData();
});

function addDarkmodeWidget() {
    new Darkmode({ label: '🌓' }).showWidget();
}

function fetchData() {
    const repo = document.getElementById('q').value.replaceAll(' ', '');
    const token = document.getElementById('token').value;
    const re = /[-_\w]+\/[-_.\w]+/;

    if (token !== '') {
        request_headers.set('Authorization', `token ${token}`);
    }

    const urlRepo = getRepoFromUrl();

    if (!urlRepo || urlRepo !== repo) {
        window.history.pushState('', '', `#${repo}`);
    }

    if (re.test(repo)) {
        fetchAndShow(repo);
    } else {
        showMsg(
            'Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;',
            'danger'
        );
    }
}

async function updateDT(data, repo, default_branch) {
    // Remove any alerts, if any:
    if ($('.alert')) $('.alert').remove();

    // Format dataset and redraw DataTable. Use second index for key name
    const forks = [];
    console.log(data);
    for (let fork of data) {
        fork.repoLink = `<a href="https://github.com/${fork.full_name}">Link</a>`;
        fork.ownerName = `<img src="${
            fork.owner.avatar_url ||
            'https://avatars.githubusercontent.com/u/0?v=4'
        }&s=48" width="24" height="24" class="mr-2 rounded-circle" />${
            fork.owner ? fork.owner.login : '<strike><em>Unknown</em></strike>'
        }`;

        let compare_uri = `https://api.github.com/repos/${repo}/compare/${default_branch}...${fork.owner.login}:${fork.default_branch}`;

        const fetch_result = api_fetch(compare_uri)
            .then((response) => {
                if (!response.ok) throw Error(response.statusText);
                return response.json();
            })
            .then((data) => {
                fork.ahead_by = data.ahead_by;
                fork.behind_by = data.behind_by;
            })
            .catch((error) => {
                const msg =
                    error.toString().indexOf('Forbidden') >= 0
                        ? 'Error: API Rate Limit Exceeded'
                        : error;
                showMsg(`${msg}. Additional info in console`, 'danger');
                console.error(error);
            });

        await fetch_result;
        forks.push(fork);
    }

    const dataSet = forks.map((fork) =>
        window.columnNamesMap.map((colNM) => fork[colNM[1]])
    );
    window.forkTable.clear().rows.add(dataSet).draw();
}

function initDT() {
    // Create ordered Object with column name and mapped display name
    window.columnNamesMap = [
        // [ 'Repository', 'full_name' ],
        ['Link', 'repoLink'], // custom key
        ['Owner', 'ownerName'], // custom key
        ['Name', 'name'],
        ['Default Branch', 'default_branch'],
        ['Ahead', 'ahead_by'], // custom key
        ['Behind', 'behind_by'], // custom key
        ['Stars', 'stargazers_count'],
        ['Forks', 'forks'],
        //['Open Issues', 'open_issues_count'],
        //['Size', 'size'],
        ['Last Update', 'pushed_at'],
    ];

    // Sort by stars:
    const sortColName = 'Stars';
    const sortColumnIdx = window.columnNamesMap
        .map((pair) => pair[0])
        .indexOf(sortColName);

    // Use first index for readable column name
    // we use moment's fromNow() if we are rendering for `pushed_at`; better solution welcome
    window.forkTable = $('#forkTable').DataTable({
        columns: window.columnNamesMap.map((colNM) => {
            return {
                title: colNM[0],
                render:
                    colNM[1] === 'pushed_at'
                        ? (data, type, _row) => {
                              if (type === 'display') {
                                  return moment(data).fromNow();
                              }
                              return data;
                          }
                        : null,
            };
        }),
        order: [[sortColumnIdx, 'desc']],
        // paging: false,
        searchBuilder: {
            // all options at default
        },
    });
    let table = window.forkTable;
    new $.fn.dataTable.SearchBuilder(table, {});
    table.searchBuilder.container().prependTo(table.table().container());
}

function api_fetch(url) {
    return fetch(url, {
        headers: request_headers,
    });
}

function fetchAndShow(repo) {
    repo = repo.replace('https://github.com/', '');
    repo = repo.replace('http://github.com/', '');
    repo = repo.replace(/\.git$/, '');
    var default_branch;

    var page_size = 50;

    api_fetch(`https://api.github.com/repos/${repo}`)
        .then((response) => {
            if (!response.ok) throw Error(response.statusText);
            return response.json();
        })
        .then((data) => {
            default_branch = data['default_branch'];
        })
        .catch((error) => {
            const msg =
                error.toString().indexOf('Forbidden') >= 0
                    ? 'Error: API Rate Limit Exceeded'
                    : error;
            showMsg(`${msg}. Additional info in console`, 'danger');
            console.error(error);
        });

    api_fetch(
        `https://api.github.com/repos/${repo}/forks?sort=stargazers&per_page=${page_size}&direction=desc`
    )
        .then((response) => {
            if (!response.ok) throw Error(response.statusText);
            return response.json();
        })
        .then((data) => {
            updateDT(data, repo, default_branch);
        })
        .catch((error) => {
            const msg =
                error.toString().indexOf('Forbidden') >= 0
                    ? 'Error: API Rate Limit Exceeded'
                    : error;
            showMsg(`${msg}. Additional info in console`, 'danger');
            console.error(error);
        });
}

function showMsg(msg, type) {
    let alert_type = 'alert-info';

    if (type === 'danger') {
        alert_type = 'alert-danger';
    }

    document.getElementById('footer').innerHTML = '';

    document.getElementById('data-body').innerHTML = `
        <div class="alert ${alert_type} alert-dismissible fade show" role="alert">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
            ${msg}
        </div>
    `;
}

function getRepoFromUrl() {
    const urlRepo = location.hash && location.hash.slice(1);

    return urlRepo && decodeURIComponent(urlRepo);
}
