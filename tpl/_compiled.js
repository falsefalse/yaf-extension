const Templates = {
<% for (var key in compiled) { %>
    '<%= key %>': <%= compiled[key] %>,
<% }; %>
};

export default Templates
