import {Application, Request, Response} from "express"
import * as uuid from "node-uuid"
import * as http from "http"
import * as url from "url"

let trackingId: string

const USER_ID_COOKIE_NAME = "cid"
const USER_ID_COOKIE_OPTIONS = {httpOnly: true, secure: true, maxAge: (2 * 365 * 24 * 60 * 60)}
const PASS_HEADERS = ["user-agent", "accept-language", "referer"]

export function configure(app: Application): Function {
  app.set("trust proxy", true)

  trackingId = process.env.GA_ID
  if (trackingId != null) {
    // we don't use signed cookies - it is not required
    app.use(require("cookie-parser")())

    app.use(router)
    return trackDownloadEvent
  }
  return null
}

function trackDownloadEvent(req: Request, res: Response, download: any) {
  sendGATrackRequest(req, {
    v: 1,
    tid: trackingId,
    t: "event",
    cid: getCid(req, res),
    ec: download.platform.type,
    ea: download.platform.filename,
    el: download.version.tag,
  })
}

function getCid(req: Request, res: Response) {
  let cid = req.cookies[USER_ID_COOKIE_NAME]
  if (cid == null) {
    cid = uuid.v4()
    res.cookie(USER_ID_COOKIE_NAME, cid, USER_ID_COOKIE_OPTIONS)
  }
  return cid
}

function router(req: Request, res: Response, next: Function) {
  sendGATrackRequest(req, {
    v: 1,
    tid: trackingId,
    t: "pageview",
    cid: getCid(req, res),
    dl: req.url,
  })
  next()
}

function sendGATrackRequest(req: Request, tracking: any) {
  console.log(req.headers)

  const xForwardedFor = req.headers["x-forwarded-for"]
  if (xForwardedFor != null) {
    tracking.uip = xForwardedFor
  }

  const data = url.format({query: tracking}).substring(1)

  const headers: any = {
    "Content-Type": "application/x-www-form-urlencoded"
  }

  for (const h of PASS_HEADERS) {
    if (req.headers[h] != null) {
      headers[h] = req.headers[h]
    }
  }

  // send the Google Analytics request, do not wait for response
  const gaRequest = http.request({
    hostname: "www.google-analytics.com",
    port: 80,
    path: "/collect",
    method: "POST",
    headers: headers
  }, (gres: any) => {
    if (gres.statusCode < 200 || gres.statusCode > 300) {
      console.error("Unexpected response from Google Analytics: HTTP " + gres.statusCode, gres)
    }
  })

  gaRequest.on("error", function (error: any) {
    console.error(error, event, headers, req, gaRequest)
  })

  gaRequest.write(data)
  gaRequest.end()
}