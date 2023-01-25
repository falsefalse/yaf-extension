// needs to have .js extension
export default { <% for (var key in compiled) { %>
  <%= key.replace('.', '_') %>: <%= compiled[key] %>,
<% }; %> }
