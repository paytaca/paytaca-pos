import axios from 'axios'

export async function getNetworkTimeDiff() {
  // Network Time Protocol (NTP) to determine absolute server time
  // https://stackoverflow.com/questions/1638337/the-best-way-to-synchronize-client-side-javascript-clock-with-server-date
  const { serverTime } = await getServerTime()
  const localTime = new Date()

  const timeDifference = serverTime - localTime
  // const adjustedTimeDiff = timeDifference + requestDuration

  // ideally the adjustedTimeDiff is used but timeDifference gives zero error
  // check by subtracting adjustedLocal - serverTime
  const adjustedLocal = new Date(localTime.getTime() + timeDifference)
  return {
    localTime,
    serverTime,
    adjustedLocal,

    timeDifference,
  }
}

// NOTE: change source, ideally watchtower
export async function getServerTime() {
  const startRequestTime = Date.now()
  const response = await axios.get(`https://watchtower.cash/api/status/?timestamp_only=true`)
  const endRequestTime = Date.now()
  const requestDuration = startRequestTime - endRequestTime

  const serverTime = new Date(response.data?.timestamp)
  return { serverTime, requestDuration }
}
