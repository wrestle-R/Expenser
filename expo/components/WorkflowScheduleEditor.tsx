import React from 'react';
import {View,Text,TextInput,TouchableOpacity,Switch} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '../context/ThemeContext';
import {Colors} from '../constants/theme';
import {WorkflowSchedule} from '../lib/types';
const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export default function WorkflowScheduleEditor({value,onChange}:{value:WorkflowSchedule|null;onChange:(value:WorkflowSchedule|null)=>void}) {
 const {isDark}=useTheme();const colors=isDark?Colors.dark:Colors.light;
 const input={borderWidth:1,borderColor:colors.border,borderRadius:10,paddingHorizontal:12,paddingVertical:13,color:colors.text,backgroundColor:colors.background,fontSize:15};
 return <View style={{borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.card,padding:16,gap:18,marginBottom:16}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <View style={{width:38,height:38,borderRadius:11,backgroundColor:colors.muted,alignItems:'center',justifyContent:'center'}}><Ionicons name="repeat-outline" size={21} color={colors.text}/></View>
   <View style={{flex:1,gap:4}}><Text style={{fontWeight:'600',fontSize:15,color:colors.text}}>Repeat automatically</Text><Text style={{fontSize:12,lineHeight:17,color:colors.textMuted}}>{value?'Your days. Your time.':'Set a routine for this workflow.'}</Text></View>
   <Switch accessibilityLabel="Repeat automatically" value={!!value} onValueChange={checked=>onChange(checked?{days:[1,2,3,4,5],time:'10:00',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:true}:null)} trackColor={{false:colors.border,true:colors.primary}} thumbColor={value?colors.primaryForeground:colors.textMuted}/>
  </View>
  {value&&<>
   <View style={{height:1,backgroundColor:colors.border}}/>
   <View style={{gap:10}}><Text style={{fontSize:12,fontWeight:'600',color:colors.textMuted}}>REPEAT ON</Text><View style={{flexDirection:'row',gap:4}}>{days.map((day,index)=><TouchableOpacity key={day} accessibilityRole="button" accessibilityState={{selected:value.days.includes(index)}} accessibilityLabel={`Repeat on ${day}`} onPress={()=>onChange({...value,days:value.days.includes(index)?value.days.filter(d=>d!==index):[...value.days,index].sort()})} style={{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,borderRadius:9,backgroundColor:value.days.includes(index)?colors.primary:colors.background}}><Text style={{fontSize:11,fontWeight:'600',color:value.days.includes(index)?colors.primaryForeground:colors.textMuted}}>{day}</Text></TouchableOpacity>)}</View></View>
   <View style={{gap:8}}><Text style={{fontSize:13,fontWeight:'500',color:colors.text}}>At what time?</Text><TextInput accessibilityLabel="Schedule time" value={value.time} onChangeText={time=>onChange({...value,time})} style={{...input,fontSize:22,fontVariant:['tabular-nums'],fontWeight:'500'}} placeholder="10:00" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={5}/><Text style={{fontSize:11,color:colors.textMuted}}>24-hour time · 10:00 is 10 AM</Text></View>
   <View style={{gap:8}}><Text style={{fontSize:13,fontWeight:'500',color:colors.text}}>Time zone</Text><TextInput accessibilityLabel="Schedule time zone" value={value.timeZone} onChangeText={timeZone=>onChange({...value,timeZone})} style={input} autoCapitalize="none" autoCorrect={false}/></View>
   <Text style={{fontSize:12,lineHeight:18,color:colors.textMuted}}>Records the amount automatically after this schedule syncs. Use “Not today” on Home to skip or undo one day. Times stay in this time zone.</Text>
  </>}
 </View>;
}
