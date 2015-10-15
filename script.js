'use strict';
/* global window */

var get = function(path){
	return window.fetch(window.document.location.origin + '/rest/api/1.0/' + path, {
		credentials: 'same-origin'
	})
		.then(function(res){ return res.json(); })
		.then(function(res){
			if (res.values)
				return res.values;
			return res;
		});
};

var flatten = function(arr){
	return [].concat.apply([], arr);
};

var importantProperty = function(left, right, f){
	if (f(left) && !f(right))
		return -1;
	if (!f(left) && f(right))
		return 1;
	return 0;
};

var isFeature = function(pr){
	return pr.fromRef.id.indexOf('refs/heads/feature') === 0
		|| pr.fromRef.displayId.match(/^[A-Z]+-\d+-/);
};

var hasReviewers = function(pr){
	return pr.reviewers.length > 0;
};

var isApproved = function(pr){
	return pr.reviewers.some(function(reviewer){ return reviewer.approved; });
};

var taskCount = function(pr){
	return parseInt(pr.attributes.openTaskCount[0], 10);
};

var hasTasks = function(pr){
	return taskCount(pr) > 0;
};

var prRepo = function(pr){
	return pr.fromRef.repository.slug;
};

var pluralize = function(n, if0, if1, otherwise){
	if (n === 0)
		return if0;
	if (n === 1)
		return if1;
	return otherwise;
};

get('projects/?limit=100')
	.then(function(projects){
		return Promise.all(projects.map(function(project){
			return get('projects/' + project.key + '/repos')
				.then(function(repos){
					return Promise.all(repos.map(function(repo){
						return get('projects/' + project.key + '/repos/' + repo.slug + '/pull-requests?limit=100&avatarSize=50');
					})).then(flatten);
				});
		})).then(flatten);
	}).then(function(prs){
		var not = function(f){
			return function(i){ return !f(i); };
		};

		prs.sort(function(left, right){
			var t = importantProperty.bind(null, left, right);
			return t(not(isApproved)) || t(not(hasReviewers)) || t(isFeature) || t(not(hasTasks))
				|| (left.updatedDate - right.updatedDate);
		});

		return prs;
	}).then(function(prs){
		window.document.body.innerHTML = ' ' +
			'<style>' +
				'body { padding: 40px; }' +
				'ul { list-style-type: none; padding: 0; }' +
				'.pr { margin: 20px -5px; padding: 5px; }' +
				'.isApproved { background-color: hsl(120, 28%, 90%); }' +
				'.hasTasks { background-color: hsl(200, 28%, 90%); }' +
				'img { vertical-align: middle; margin: 0; }' +
				'.authorAvatar { float:left; clear: left; margin-right: 10px; }' +
				'.title { display: block; }' +
				'.taskCount { margin: 0 10px; }' +
				'.pr:not(.hasTasks) .taskCount { opacity: 0.5; }' +
				'[data-approved] { border-bottom: 3px solid transparent; }' +
				'[data-approved="true"] { border-color: green; }' +
			'</style>' +
			'<p>Pull requests that need attention are at the top.</p>' +
			'<ul>' +
			prs.map(function(pr){
				return '<li class="pr ' +
						(isApproved(pr) ? 'isApproved' : '') +
						(hasTasks(pr) ? 'hasTasks' : '') +
					' ">' +
					'<img class=authorAvatar width=50 src="' + pr.author.user.avatarUrl + '">' +
					'<a href="' + pr.links.self[0].href + '" class=title>' + prRepo(pr) + ' / ' + pr.title + '</a>' +
					pr.reviewers.map(function(reviewer){
						return '<img width=30 src="' + reviewer.user.avatarUrl + '" data-approved="' + String(reviewer.approved) + '">';
					}).join('') +
					'<span class=taskCount>' +
						pluralize(taskCount(pr), '', '1 task', taskCount(pr) + ' tasks') +
					'</span>' +
				'</li>';
			}).join('') +
			'</ul>';
	});
