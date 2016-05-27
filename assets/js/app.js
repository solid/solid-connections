(function () {
  var $rdf = window.$rdf
  // common vocabs
  // var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
  var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/')
  // var DCT = $rdf.Namespace('http://purl.org/dc/terms/')
  // var LDP = $rdf.Namespace('http://www.w3.org/ns/ldp#')
  // var SIOC = $rdf.Namespace('http://rdfs.org/sioc/ns#')
  var SOLID = $rdf.Namespace('http://www.w3.org/ns/solid/terms#')

  // init static elements
  var search = document.getElementById('search')
  var feedback = document.getElementById('feedback')
  var newModal = document.getElementById('new')
  var overlay = document.getElementById('overlay')
  var infoButtons = document.getElementById('info-buttons')
  var addNewBtn = document.getElementById('add-new')
  var cancelNewBtn = document.getElementsByClassName('cancel-new')
  var showNewModal = document.getElementById('show-new')
  var lookupElement = document.getElementById('lookup')
  var profileInfo = document.getElementById('profile-info')

  var Solid = require('solid')

  // ------------ LIST CONF ------------
  var connectionTemplate = '<div class="user-card center">' +
    '<figure class="avatar avatar-xl initials inline-block">' +
    ' <img class="picture">' +
    '</figure>' +
    '<div class="inline-block ml-10">' +
    ' <div class="name"></div>' +
    ' <div class="email"></div>' +
    ' <div class="status green"></div>' +
    '</div>' +
  '</div>'

  var options = {
    listClass: 'connections-list',
    searchClass: 'search-connection',
    valueNames: [
      'name',
      'email',
      'webid',
      'status',
      { attr: 'src', name: 'picture' },
      { attr: 'class', name: 'image' },
      { attr: 'href', name: 'link' },
      { attr: 'data-initial', name: 'initials' }
    ],
    item: connectionTemplate
  }

  var defaultFields = ['name', 'email']

  var values = [
    {
      name: 'Jon Doe',
      email: 'john@doe.com',
      picture: 'https://picturepan2.github.io/spectre/demo/img/avatar-1.png'
    },
    {
      name: 'Jane Doe',
      email: 'jane@doe.com',
      picture: 'https://picturepan2.github.io/spectre/demo/img/avatar-3.png'
    },
    {
      name: 'Adam Crow',
      email: 'james@crow.com',
      picture: 'https://picturepan2.github.io/spectre/demo/img/avatar-2.png',
      status: 'CONNECTED'
    },
    {
      name: 'Mike Smith',
      email: 'm@smith.net',
      initials: 'M S',
      picture: 'assets/images/empty.png'
    }
  ]

  // Init list
  var uList = new window.List('connections', options, values)
  uList.sort('name', { order: 'asc' })

  // ------------ END LIST CONF ------------

  // Search the connections list for a given value
  // @param fields {array}
  var searchList = function (fields) {
    fields = fields || defaultFields
    var searchVal = document.getElementById('search').value
    if (searchVal.length >= 2) {
      uList.search(searchVal, fields)
    } else {
      uList.search()
    }
  }

  var addConnection = function (profile) {
    showElement(lookupElement)
    showElement(infoButtons)
    if (uList.get('webid', profile.webid).length > 0) {
      addFeedback('error', 'You are already connected to this user')
      return
    }
    var item = {}
    item.webid = profile.webid
    item.name = profile.name
    if (profile.picture) {
      item.picture = profile.picture
    } else {
      item.picture = 'assets/images/empty.png'
      item.initials = getInitials(profile.name)
    }
    if (profile.email) {
      item.picture = profile.picture
    }
    uList.add(item)
    addFeedback('success', 'You have a new connection!')
    uList.sort('name', { order: 'asc' })
  }

  // Fetch a WebID profile using Solid.js
  var findWebID = function () {
    var webid = document.getElementById('webid').value
    if (!webid || webid.length === 0) {
      console.log('No webid specified')
      addFeedback('error', 'You need to provide a WebID')
      return
    }

    showLoadingButton(addNewBtn)

    Solid.identity.getProfile(webid)
    .then(function (resp) {
      var profile = importSolidProfile(resp)
      if (!profile) {
        addFeedback('error', 'Error parsing user profile data')
      }
      // clear the contents of the modal
      hideElement(lookupElement)
      hideElement(infoButtons)

      decorateProfile(profile, profileInfo)
      hideLoadingButton(addNewBtn)
    })
    .catch(function (err) {
      console.log(err)
      addFeedback('error', 'Could not load profile: ' + err.statusText)
      hideLoadingButton(addNewBtn)
      showElement(infoButtons)
    })
  }

  var importSolidProfile = function (data) {
    var profile = {}

    if (!data.parsedGraph) {
      return null
    }

    var g = data.parsedGraph
    var webid = data.webId
    // set webid
    profile.webid = webid

    var webidRes = $rdf.sym(webid)

    // set name
    var name = g.any(webidRes, FOAF('name'))
    if (name && name.value.length > 0) {
      profile.name = name.value
    } else {
      profile.name = ''
      // use familyName and givenName instead of full name
      var givenName = g.any(webidRes, FOAF('givenName'))
      if (givenName) {
        profile.name += givenName.value
      }
      var familyName = g.any(webidRes, FOAF('familyName'))
      if (familyName) {
        profile.name += (givenName) ? ' ' + familyName.value : familyName.value
      }
      // use nick
      if (!givenName && !familyName) {
        var nick = g.any(webidRes, FOAF('nick'))
        if (nick) {
          profile.name = nick.value
        }
      }
    }

    // set picture
    var img = g.any(webidRes, FOAF('img'))
    var pic
    if (img) {
      pic = img
    } else {
      // check if profile uses depic instead
      var depic = g.any(webidRes, FOAF('depiction'))
      if (depic) {
        pic = depic
      }
    }
    if (pic && pic.uri.length > 0) {
      profile.picture = pic.uri
    }

    var email = g.any(webidRes, FOAF('mbox'))
    if (email) {
      profile.email = email.uri
      if (profile.email.indexOf('mailto:') === 0) {
        profile.email = profile.email.slice(7)
      }
    }

    var inbox = g.any(webidRes, SOLID('inbox'))
    if (inbox) {
      profile.inbox = inbox.uri
    }

    return profile
  }

  var decorateProfile = function (profile, parent) {
    var card = document.createElement('div')
    card.classList.add('card', 'no-border')

    var image = document.createElement('div')
    card.appendChild(image)
    image.classList.add('card-image')

    if (profile.picture) {
      var picture = document.createElement('img')
      picture.classList.add('img-responsive', 'centered')
      picture.src = profile.picture
      image.appendChild(picture)
    }

    var header = document.createElement('div')
    card.appendChild(header)
    header.classList.add('card-header')

    if (profile.name) {
      var name = document.createElement('h4')
      name.classList.add('card-title', 'text-center')
      name.innerHTML = profile.name
      header.appendChild(name)
    }

    if (profile.email) {
      var email = document.createElement('h6')
      email.classList.add('card-meta')
      email.innerHTML = profile.email
      header.appendChild(email)
    }

    var body = document.createElement('div')
    card.appendChild(body)
    body.classList.add('card-body')
    body.innerHTML = 'Would you like to connect with this person?'

    var footer = document.createElement('div')
    card.appendChild(footer)
    footer.classList.add('card-footer', 'text-right')

    var cancel = document.createElement('button')
    footer.appendChild(cancel)
    cancel.classList.add('btn', 'btn-link')
    cancel.innerHTML = 'Cancel'
    cancel.addEventListener('click', function () {
      deleteElement(card)
      showElement(lookupElement)
      showElement(infoButtons)
    }, false)

    var button = document.createElement('button')
    footer.appendChild(button)
    button.classList.add('btn', 'btn-primary')
    button.innerHTML = 'Connect'
    button.addEventListener('click', function () {
      addConnection(profile)
      deleteElement(card)
      closeModal()
    }, false)

    // finish
    parent.appendChild(card)
  }

  var getInitials = function (name) {
    var initials = ''
    if (name.length <= 2) {
      return name.toUpperCase()
    }
    if (name.indexOf(' ') >= 0) {
      var pieces = name.split(' ')
      for (var i = 0; i < pieces.length; i++) {
        if (initials.length > 0) {
          initials += ' '
        }
        initials += pieces[i][0].toUpperCase()
        if (i === 1) {
          break
        }
      }
    }
    return initials
  }

  // ------------ FEEDBACK ------------

  // Add visual feedback (toast) element to the DOM
  // @param msgType {string} one value of type [info, success, error]
  // @param msg {string} message to send
  var addFeedback = function (msgType, msg) {
    msgType = msgType || 'info'
    var timeout = 2000

    switch (msgType) {
      case 'success':
        msgType = 'toast-success'
        break
      case 'error':
        msgType = 'toast-danger'
        break
      default:
        msgType = 'toast-primary'
        break
    }

    var div = document.createElement('div')
    div.classList.add('toast', 'centered', msgType)
    var btn = document.createElement('button')
    btn.classList.add('btn', 'btn-clear', 'float-right')
    // add event listener
    btn.addEventListener('click', function () {
      clearFeedback(div)
    }, false)
    // add self-timeout
    window.setTimeout(function () {
      clearFeedback(div)
    }, timeout)
    // add the message
    div.innerHTML = msg
    // add button
    div.appendChild(btn)
    // append toast to DOM
    feedback.appendChild(div)
  }

  // Remove a feedback element
  // @param msg {string} message to send
  var clearFeedback = function (elem) {
    elem.parentNode.removeChild(elem)
  }

  // ------------ MODAL ------------
  var closeModal = function () {
    hideElement(newModal)
    hideElement(overlay)
    overlay.style.display = 'none'
  }

  var showModal = function () {
    showElement(newModal)
    showElement(overlay)
    overlay.style.display = 'flex'
  }

  // ------------ UTILITY ------------
  var hideElement = function (elem) {
    if (elem) {
      elem.classList.add('hidden')
    }
  }

  var showElement = function (elem) {
    if (elem) {
      elem.classList.remove('hidden')
    }
  }

  var deleteElement = function (elem) {
    elem.parentNode.removeChild(elem)
  }

  var showLoadingButton = function (elem) {
    elem.classList.add('loading')
  }

  var hideLoadingButton = function (elem) {
    elem.classList.remove('loading')
  }

  // ------------ EVENT LISTENERS ------------

  // search event listener
  search.addEventListener('keyup', function () {
    searchList()
  }, false)

  showNewModal.addEventListener('click', function () {
    showModal()
  }, false)

  addNewBtn.addEventListener('click', function () {
    findWebID()
  }, false)

  // close modal clicks
  for (var i = 0; i < cancelNewBtn.length; i++) {
    cancelNewBtn[i].addEventListener('click', function () {
      closeModal()
    }, false)
  }

  // public methods
  return {
    addFeedback: addFeedback
  }
})()