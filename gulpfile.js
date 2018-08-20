'use strict';

var fs = require('fs')
var gulp = require('gulp')
var watch = require('gulp-watch')
var rigger = require('gulp-rigger')
var sequence = require('gulp-sequence')
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var rimraf = require('rimraf')
var mkdirp = require("mkdirp")
var gutil  = require('gulp-util');
var zip    = require('gulp-zip');
var args   = require('yargs').argv;

var cfg = {
    
    dev: {
        
        target: './docs',
        
        assets: [
            './src/**/*.*',
            '!./src/js/**/*.*',
            '!./src/css/*.*',
            '!./src/masks/*.*'
        ],
        assetsRussia: [
            './src/**/*.*',
            '!./src/json/VP*.*',
            '!./src/resources/VP*/**',
            '!./src/js/**/*.*',
            '!./src/css/*.*',
            '!./src/masks/*.*'
        ],
        assetsRedwings: [
            './src/**/*.*',
            '!./src/json/VQ*.*',
            '!./src/json/EI*.*',
            '!./src/resources/VQ*/**',
            '!./src/resources/EI*/**',
            '!./src/js/**/*.*',
            '!./src/css/*.*',
            '!./src/masks/*.*'
        ],
        
        js_static: [
            './src/js/const.js'],
        
        js_build: ['./src/js/common.js'],
        css_watch: [
            './src/css/*.*'
        ],

        css_build: [
            './src/css/common.scss',
            './src/css/layout_small.scss',
            './src/css/layout_big.scss',
            './src/css/list-transaero.css',
            './src/css/list.css'
        ]

    }
    
}

var data = cfg.dev

function getDateTime() {
    var now     = new Date(); 
    var year    = now.getFullYear();
    var month   = now.getMonth()+1; 
    var day     = now.getDate();
   
    if((''+month).length == 1) { month = '0'+month; }
    if((''+day  ).length == 1) { var day = '0'+day; }
    var dateTime = [day, month].join('.');

    return dateTime;
}

gulp.task('clean', function(cb) {
    rimraf(data.target, cb);
})

gulp.task('make-dir', function(cb) {
    mkdirp.sync(data.target)
    cb()
})

gulp.task('copy:assets', function() {
    var env  = (args && args.env) || 'build',
        patterns = {
            russia: data.assetsRussia,
            redwings: data.assetsRedwings,
            build: data.assets
        };

    return gulp.src(patterns[env])
                .pipe(gulp.dest(data.target))   
})

gulp.task('copy:js', function() {
    return gulp.src(data.js_static)
                .pipe(gulp.dest(data.target + '/js'))   
})

gulp.task('build:js', function () {
    return gulp.src(data.js_build)
                .pipe(rigger())
                .pipe(uglify())
                .on('error', function (err) { gutil.log(gutil.colors.red('[Error]'), err.toString()); })
                .pipe(gulp.dest(data.target + '/js'))
})

gulp.task('sass', function () {
    return gulp.src(data.css_build)
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest(data.target + '/css'));
});
gulp.task('sass:watch', function () {
    return gulp.watch(data.css_watch, ['sass']);
});
gulp.task('zip', function () {
    var date = getDateTime();

    var env  = (args && args.env) || 'build',
    patterns = {
        russia: 'russia',
        redwings: 'redwings',
        build: 'allFlight'
    };
    
    var assets = patterns[env]
    var name = assets +'('+date+').zip'

    return gulp.src(data.target+'/**')
        .pipe(zip(name))
        .pipe(gulp.dest('./folder_dist_zip'))
});


gulp.task('watch', function() {
    gulp.watch('./src/css/*.*', ['sass'])
    gulp.watch('./src/js/*.*', ['build:js'])
    gulp.watch(data.assets, ['copy:assets'])
})

gulp.task('copy', sequence('copy:assets', 'copy:js'))
gulp.task('build_zip', sequence('clean', 'make-dir', 'sass', 'build:js', 'copy', 'zip'))
gulp.task('default',   sequence('clean', 'make-dir', 'sass', 'build:js', 'copy', 'watch'))