TPL = {
<% for (var key in compiled) { %>
    '<%= key %>': <%= compiled[key] %>,
<% }; %>
};
