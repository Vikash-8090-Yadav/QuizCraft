import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES, QUIZ_CRAFT_ARENA_ABI } from '@/lib/contracts'
import { CONFLUX_TESTNET } from '@/lib/constants'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lobbyId = Number(searchParams.get('lobbyId'))
    if (!lobbyId) return NextResponse.json({ error: 'Missing lobbyId' }, { status: 400 })

    // Get players from smart contract
    let playersList: string[] = []
    try {
      const rpcProvider = new ethers.JsonRpcProvider(CONFLUX_TESTNET.rpcUrl)
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
        QUIZ_CRAFT_ARENA_ABI,
        rpcProvider
      )
      playersList = await contract.getPlayersInLobby(lobbyId)
      console.log('Players from contract:', playersList)
    } catch (contractError) {
      console.error('Error fetching players from contract:', contractError)
      // If contract fails, we'll get players from game results instead
    }

    // Get all games for this lobby first
    const { data: games, error: gamesErr } = await supabase
      .from('games')
      .select('id')
      .eq('lobby_id', lobbyId)

    let gameResults: any[] = []
    
    if (!gamesErr && games && games.length > 0) {
      // Get all game results for all games in this lobby
      const gameIds = games.map(g => g.id)
      console.log('Game IDs for lobby:', gameIds)
      
      const { data: allGameResults, error: resErr } = await supabase
        .from('game_results')
        .select('*')
        .in('game_id', gameIds)
        .order('score', { ascending: false })

      if (!resErr && allGameResults) {
        gameResults = allGameResults || []
        console.log('All game results for lobby:', gameResults)
      } else {
        console.error('Error fetching game results:', resErr)
      }
    } else {
      console.log('No games found for lobby:', lobbyId, gamesErr)
    }

    // If we couldn't get players from contract, get them from game results
    if (playersList.length === 0 && gameResults.length > 0) {
      const uniquePlayers = [...new Set(gameResults.map(r => r.player_address))]
      playersList = uniquePlayers
      console.log('Got players from game results:', playersList)
    }

    // Combine players with their scores (take highest score if multiple entries)
    const allPlayersWithScores = playersList.map(playerAddress => {
      const playerResults = gameResults.filter(result => 
        result.player_address.toLowerCase() === playerAddress.toLowerCase()
      )
      
      // If player has multiple scores, take the highest one
      const bestResult = playerResults.reduce((best, current) => {
        return (current.score > best.score) ? current : best
      }, playerResults[0] || null)
      
      console.log(`Player ${playerAddress}: ${playerResults.length} results found`, playerResults)
      
      return {
        player_address: playerAddress,
        score: bestResult?.score || 0,
        correct_answers: bestResult?.correct_answers || 0,
        total_questions: bestResult?.total_questions || 0,
        time_bonus: bestResult?.time_bonus || 0,
        has_played: !!bestResult
      }
    })

    console.log('Combined players with scores:', allPlayersWithScores)

    return NextResponse.json({ 
      players: allPlayersWithScores,
      totalPlayers: playersList.length,
      playersWithScores: gameResults.length,
      debug: {
        lobbyId,
        playersFromContract: playersList,
        allGameResults: gameResults,
        finalCombined: allPlayersWithScores
      }
    })
  } catch (e: any) {
    console.error('all-players error', e)
    return NextResponse.json({ error: 'Unexpected error', details: e.message }, { status: 500 })
  }
}
