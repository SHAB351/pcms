# Suivi de session

État courant d'une session autonome. Le CTO le relit **avant chaque tâche** et le
met à jour **après chaque tâche**. C'est le seul endroit qui répond à « où en
est-on maintenant ».

---

## État

| Champ | Valeur |
| --- | --- |
| Statut | `AUCUNE SESSION EN COURS` |
| Branche | `feature/assistant-ia` |
| Tâche en cours | — |
| Tâches prouvées cette session | 0 |
| Tâches écartées cette session | 0 |
| Dernière mise à jour | 2026-11-10T04:20Z |

## Ouvrir une session

Le lanceur inscrit ici :

```
Début     : <ISO 8601 UTC>   epoch: <date -u +%s>
Échéance  : <début + durée>  epoch: <epoch début + secondes>
Durée     : 4 h
```

Le CTO compare `date -u +%s` à l'epoch d'échéance avant chaque tâche. Au-delà, il
n'entame rien de nouveau et rédige le rapport.

## Déroulé

Une ligne par tâche, ajoutée à la suite :

```
<T0 → T1> | <ID> | <agent> | <PROUVÉ|ÉCARTÉE> | <une phrase de résultat>
```

_(vide pour l'instant)_

## Écarts — à traiter par un humain

Tout ce qu'un agent n'a pas le droit de faire, ou qu'il n'a pas pu faire, atterrit
ici. Le rapport final les reprend.

_(vide pour l'instant)_
