export default {<% for (var key in compiled) { %>
  <%= key.replace('.', '_') %>: <%= compiled[key] %>,
<% }; %> }
