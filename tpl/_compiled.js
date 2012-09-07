TPL = {
<% _.forEach(compiled, function(source, id) { %>
    '<%= id %>': <%= source %>,
<% }); %>
};
