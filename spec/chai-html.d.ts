// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/chai-html/index.d.ts
declare module 'chai-html' {
  global {
    namespace Chai {
      interface Assertion {
        htmll: ChaiHtml.HtmlAssertion
      }
    }
  }

  namespace ChaiHtml {
    interface HtmlAssertion extends Chai.Assertion {
      ignoringComments: Chai.Assertion
    }
  }

  const chaiHtml: Chai.ChaiPlugin
  namespace chaiHtml {}

  export default chaiHtml
}
