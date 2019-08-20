/*jshint esversion: 6 */

class NgTransloadit {
  constructor($http, $rootScope, $timeout) {
    // $scope = $rootScope.$new();
    this.TRANSLOADIT_API = 'https://api2.transloadit.com/assemblies';
    this.cancelled = false;
    this.options = {};
    this.xhr = new XMLHttpRequest();
  }

  zeroFill(number, width) {
    width -= number.toString().length;
    if (width > 0) {
      return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
    }

    return number + ''; // always return a string
  }

  getExpiryDate() {
    var date = new Date();
    date.setHours(date.getHours() + 12);

    var year = date.getUTCFullYear();
    var month = this.zeroFill(date.getUTCMonth() + 1, 2);
    var day = this.zeroFill(date.getUTCDate(), 2);

    var hours = this.zeroFill(date.getUTCHours(), 2);
    var minutes = this.zeroFill(date.getUTCMinutes(), 2);
    var seconds = this.zeroFill(date.getUTCSeconds(), 2);

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}+00:00`;
  }

  _validateBrowser() {
    var isXHR2 = typeof new XMLHttpRequest().upload !== 'undefined';

    if (!isXHR2) {
      throw new Error('Transloadit will only work with XMLHttpRequest 2');
    }
  }

  _validateOptions(options) {
    // mandatory fields
    if (!options.signature) {
      throw new Error('must supply a signature function');
    }

    if (!options.uploaded) {
      throw new Error('must supply an uploaded callback');
    }

    if (!options.params) {
      throw new Error('must supply params');
    }

    if (!options.params.auth.key) {
      throw new Error('must supply a key');
    }

    // optional fields
    options.processing = options.processing || function() {};
    options.progress = options.progress || function() {};
    options.error = options.error || function() {};
  }

  _addExpiryDate(options) {
    options.params.auth.expires = this.getExpiryDate();
  }

  _setApiUrl(url) {
    this.TRANSLOADIT_API = url;
  }

  upload(file, options) {
    this.file = file;
    this.options = options;
    this._validateBrowser();
    this._validateOptions(this.options);
    this._addExpiryDate(this.options);

    this.options.signature((signatureValue) => {
      let paramsValue = angular.toJson(this.options.params);

      let formData = new FormData();
      formData.append('params', paramsValue);
      formData.append('signature', signatureValue);
      formData.append(this.file.name, this.file);

      if (this.options.fields) {
        for (let property in this.options.fields) {
          if (this.options.fields.hasOwnProperty(property)) {
            formData.append(property, this.options.fields[property]);
          }
        }
      }

      this.xhr.open('POST', this.TRANSLOADIT_API, true);
      this.xhr.onload = (response) => {
        var results = angular.fromJson(this.response);
        this.options.processing();
        this.check(results.assembly_ssl_url);
      };

      this.xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          this.options.progress(e.loaded, e.total);
        }
      };

      this.xhr.send(formData);
    });

  }

  check(assemblyUrl) {
    if (this.cancelled) {
      return false;
    }

    this.$timeout(() => {
      this.$http.get(assemblyUrl).success((results) => {
        if (results.ok === 'ASSEMBLY_COMPLETED') {
          this.options.uploaded(results);
        } else {
          this.check(results.assembly_ssl_url);
        }
      }).error(this.options.error);
    }, 2000);
  }

  cancel() {
    this.cancelled = true;
    this.xhr.abort();
  }

}

export default angular.module('NgTransloadit', [])
  .factory('Transloadit', ['$http', '$rootScope', '$timeout', NgTransloadit]);
